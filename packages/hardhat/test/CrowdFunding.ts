import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { CrowdFunding, SecurityToken, EnergyToken, UtilityToken } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("CrowdFunding", function () {
  // Test variables
  let crowdfunding: CrowdFunding;
  let securityToken: SecurityToken;
  let utilityToken: UtilityToken;
  let energyToken: EnergyToken;
  let owner: SignerWithAddress;
  let auditor: SignerWithAddress;
  let generalContractor: SignerWithAddress;
  let client: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let investor3: SignerWithAddress;

  // Constants
  const ONE_DAY = 86400;
  const ONE_WEEK = ONE_DAY * 7;
  const TARGET_AMOUNT = ethers.parseEther("1000");
  const MILESTONE_AMOUNTS = [ethers.parseEther("300"), ethers.parseEther("400"), ethers.parseEther("300")];
  const initialSupply = ethers.parseEther("10000"); // Increased initial supply

  beforeEach(async () => {
    // Get signers
    [owner, auditor, generalContractor, client, investor1, investor2, investor3] = await ethers.getSigners();

    // Deploy mock tokens
    const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
    securityToken = (await SecurityTokenFactory.deploy(initialSupply)) as SecurityToken;
    await securityToken.waitForDeployment();

    const UtilityTokenFactory = await ethers.getContractFactory("UtilityToken");
    utilityToken = (await UtilityTokenFactory.deploy(ethers.parseEther("10000"))) as UtilityToken;
    await utilityToken.waitForDeployment();

    const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
    energyToken = (await EnergyTokenFactory.deploy("EnergyToken", "ERGY")) as EnergyToken;
    await energyToken.waitForDeployment();

    // Set up investment period (1 week from now)
    const currentTimestamp = await time.latest();
    const investmentPeriod = currentTimestamp + ONE_WEEK;

    // Deploy crowdfunding contract
    const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
    crowdfunding = (await CrowdFundingFactory.deploy(
      await securityToken.getAddress(),
      await utilityToken.getAddress(),
      await energyToken.getAddress(),
      investmentPeriod,
      TARGET_AMOUNT,
      auditor.address,
      generalContractor.address,
      client.address,
      MILESTONE_AMOUNTS,
    )) as CrowdFunding;
    await crowdfunding.waitForDeployment();

    // Set energy token crowdfunding address
    await energyToken.setCrowdFundingContract(await crowdfunding.getAddress());

    // Transfer tokens to participants
    // Mint security tokens to client for pledging
    await securityToken.transfer(client.address, TARGET_AMOUNT);

    // Check the balance after the transfer to confirm

    // Mint utility tokens to investors
    await utilityToken.transfer(investor1.address, ethers.parseEther("400"));
    await utilityToken.transfer(investor2.address, ethers.parseEther("400"));
    await utilityToken.transfer(investor3.address, ethers.parseEther("400"));

    // // Log investor balances to confirm
    // console.log("Investor1 utility token balance:", (await utilityToken.balanceOf(investor1.address)).toString());
    // console.log("Investor2 utility token balance:", (await utilityToken.balanceOf(investor2.address)).toString());
    // console.log("Investor3 utility token balance:", (await utilityToken.balanceOf(investor3.address)).toString());
  });

  describe("Deployment", function () {
    it("Should set the correct state variables", async function () {
      expect(await crowdfunding.auditor()).to.equal(auditor.address);
      expect(await crowdfunding.generalContractor()).to.equal(generalContractor.address);
      expect(await crowdfunding.client()).to.equal(client.address);
      expect(await crowdfunding.securityToken()).to.equal(await securityToken.getAddress());
      expect(await crowdfunding.utilityToken()).to.equal(await utilityToken.getAddress());
      expect(await crowdfunding.energyToken()).to.equal(await energyToken.getAddress());

      const proposal = await crowdfunding.proposal();
      expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);
    });
  });

  describe("Token Pledging", function () {
    it("Should allow client to pledge security tokens", async function () {
      // Approve tokens for transfer
      await securityToken.connect(client).approve(await crowdfunding.getAddress(), TARGET_AMOUNT);

      // Pledge tokens
      await expect(crowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT))
        .to.emit(crowdfunding, "TokensPledged")
        .withArgs(client.address, TARGET_AMOUNT);

      // Check token pledged status
      const pledgedStatus = await crowdfunding.tokensPledged();
      expect(pledgedStatus).to.equal(true);

      // Check security token balance of contract
      expect(await securityToken.balanceOf(await crowdfunding.getAddress())).to.equal(TARGET_AMOUNT);

      // Check energy tokens minted to contract
      expect(await energyToken.balanceOf(await crowdfunding.getAddress())).to.equal(TARGET_AMOUNT);
    });

    it("Should not allow non-client to pledge tokens", async function () {
      await securityToken.connect(client).approve(await crowdfunding.getAddress(), TARGET_AMOUNT);
      await expect(crowdfunding.connect(investor1).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith(
        "Only the client can pledge tokens",
      );
    });

    it("Should fail if pledge amount is zero", async function () {
      await expect(crowdfunding.connect(client).pledgeTokens(0)).to.be.revertedWith(
        "Pledge amount must be greater than zero",
      );
    });

    it("Should fail if allowance is insufficient", async function () {
      // Deploy a fresh contract to test with
      const investmentPeriod = (await time.latest()) + ONE_WEEK;

      const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
      const newCrowdfunding = (await CrowdFundingFactory.deploy(
        await securityToken.getAddress(),
        await utilityToken.getAddress(),
        await energyToken.getAddress(),
        investmentPeriod,
        TARGET_AMOUNT,
        auditor.address,
        generalContractor.address,
        client.address,
        MILESTONE_AMOUNTS,
      )) as CrowdFunding;
      await newCrowdfunding.waitForDeployment();

      // Don't approve
      await expect(newCrowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith("Allowance too low");
    });
  });

  describe("Investment", function () {
    beforeEach(async function () {
      // Pledge tokens for each investment test
      await securityToken.connect(client).approve(await crowdfunding.getAddress(), TARGET_AMOUNT);
      await crowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT);

      // Approve utility tokens for investment
      await utilityToken.connect(investor1).approve(await crowdfunding.getAddress(), ethers.parseEther("400"));
      await utilityToken.connect(investor2).approve(await crowdfunding.getAddress(), ethers.parseEther("400"));
      await utilityToken.connect(investor3).approve(await crowdfunding.getAddress(), ethers.parseEther("400"));
    });

    it("Should allow investors to invest", async function () {
      await expect(crowdfunding.connect(investor1).invest(ethers.parseEther("200")))
        .to.emit(crowdfunding, "InvestmentReceived")
        .withArgs(investor1.address, ethers.parseEther("200"));

      // Check investor balance
      expect(await crowdfunding.investorBalances(investor1.address)).to.equal(ethers.parseEther("200"));
      expect(await crowdfunding.fundsRaised()).to.equal(ethers.parseEther("200"));
      expect(await crowdfunding.pendingEnergyTokens(investor1.address)).to.equal(ethers.parseEther("200"));
    });

    it("Should automatically mark funding as successful when target is reached", async function () {
      // Invest from multiple investors to reach the target
      await crowdfunding.connect(investor1).invest(ethers.parseEther("400"));
      await crowdfunding.connect(investor2).invest(ethers.parseEther("400"));

      // This should trigger funding successful when the target is met
      await expect(crowdfunding.connect(investor3).invest(ethers.parseEther("200"))).to.emit(
        crowdfunding,
        "FundingSuccessful",
      );

      // Verify that funding was marked as successful
      const fundingStatus = await crowdfunding.fundingSuccessful();
      expect(fundingStatus).to.equal(true);

      // Verify if the energy tokens were released
      const energyTokensStatus = await crowdfunding.energyTokensReleased();
      expect(energyTokensStatus).to.equal(true);
    });

    it("Should not allow investment before tokens are pledged", async function () {
      // Deploy a fresh contract without pledged tokens
      const investmentPeriod = (await time.latest()) + ONE_WEEK;

      const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
      const newCrowdfunding = (await CrowdFundingFactory.deploy(
        await securityToken.getAddress(),
        await utilityToken.getAddress(),
        await energyToken.getAddress(),
        investmentPeriod,
        TARGET_AMOUNT,
        auditor.address,
        generalContractor.address,
        client.address,
        MILESTONE_AMOUNTS,
      )) as CrowdFunding;
      await newCrowdfunding.waitForDeployment();

      // Approve tokens for investment but don't pledge security tokens
      await utilityToken.connect(investor1).approve(await newCrowdfunding.getAddress(), ethers.parseEther("100"));

      // Try to invest before tokens are pledged
      await expect(newCrowdfunding.connect(investor1).invest(ethers.parseEther("100"))).to.be.revertedWith(
        "INVEST: Security tokens not pledged",
      );
    });

    it("Should not allow investment after investment period", async function () {
      // Fast forward time to after investment period
      await time.increase(ONE_WEEK + 1);

      // Try to invest after investment period
      await expect(crowdfunding.connect(investor1).invest(ethers.parseEther("100"))).to.be.revertedWith(
        "INVEST: Investment period has ended",
      );
    });

    it("Should not allow investment after funding is successful", async function () {
      // First make funding successful
      await crowdfunding.connect(investor1).invest(ethers.parseEther("400"));
      await crowdfunding.connect(investor2).invest(ethers.parseEther("400"));
      await crowdfunding.connect(investor3).invest(ethers.parseEther("200"));

      // Try to invest more after target reached
      await expect(crowdfunding.connect(investor1).invest(ethers.parseEther("100"))).to.be.revertedWith(
        "INVEST: Funding already successful",
      );
    });

    it("Should check funding status correctly", async function () {
      // Invest some amount but not enough
      await crowdfunding.connect(investor1).invest(ethers.parseEther("300"));

      // Before investment period ends, funding should not be successful
      const fundingStatusBefore = await crowdfunding.checkFundingStatus();
      expect(fundingStatusBefore).to.equal(false);

      // Fast forward time beyond the investment period
      await time.increase(ONE_WEEK + 1);

      // Now funding should be marked as failed
      const fundingStatusAfter = await crowdfunding.checkFundingStatus();
      expect(fundingStatusAfter).to.equal(false);
    });
  });

  describe("Emergency Stop", function () {
    beforeEach(async function () {
      // Pledge tokens for each emergency test
      await securityToken.connect(client).approve(await crowdfunding.getAddress(), TARGET_AMOUNT);
      await crowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT);

      // Approve utility tokens for investment
      await utilityToken.connect(investor1).approve(await crowdfunding.getAddress(), ethers.parseEther("100"));
    });

    it("Should allow owner to toggle emergency stop", async function () {
      await expect(crowdfunding.connect(owner).toggleEmergencyStop())
        .to.emit(crowdfunding, "EmergencyToggled")
        .withArgs(true);

      const emergencyStatusFirst = await crowdfunding.emergencyStop();
      expect(emergencyStatusFirst).to.equal(true);

      await expect(crowdfunding.connect(owner).toggleEmergencyStop())
        .to.emit(crowdfunding, "EmergencyToggled")
        .withArgs(false);

      const emergencyStatusSecond = await crowdfunding.emergencyStop();
      expect(emergencyStatusSecond).to.equal(false);
    });

    it("Should prevent investment when emergency stop is active", async function () {
      // Enable emergency stop
      await crowdfunding.connect(owner).toggleEmergencyStop();

      // Try to invest
      await expect(crowdfunding.connect(investor1).invest(ethers.parseEther("100"))).to.be.revertedWith(
        "Contract is in emergency stop",
      );
    });

    it("Should not allow non-owner to toggle emergency stop", async function () {
      await expect(crowdfunding.connect(investor1).toggleEmergencyStop())
        .to.be.revertedWithCustomError(crowdfunding, "OwnableUnauthorizedAccount")
        .withArgs(investor1.address);
    });
  });
});
