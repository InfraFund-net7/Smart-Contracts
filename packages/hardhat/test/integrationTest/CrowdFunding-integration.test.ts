import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CrowdFunding Integration Tests", function () {
  // Test variables
  let crowdFunding: any;
  let securityToken: any;
  let mockUSDC: any;
  let energyToken: any;

  // Signers
  let deployer: HardhatEthersSigner;
  let auditor: HardhatEthersSigner;
  let generalContractor: HardhatEthersSigner;
  let client: HardhatEthersSigner;
  let investor1: HardhatEthersSigner;
  let investor2: HardhatEthersSigner;
  let investor3: HardhatEthersSigner;
  let energyProvider: HardhatEthersSigner;

  // Contract addresses
  let crowdFundingAddress: string;
  let securityTokenAddress: string;
  let mockUSDCAddress: string;
  let energyTokenAddress: string;

  // Constants for test
  const investmentPeriod = 7 * 24 * 60 * 60; // 7 days in seconds
  const targetAmount = ethers.parseEther("1000");
  const milestoneAmounts = [ethers.parseEther("300"), ethers.parseEther("400"), ethers.parseEther("300")];
  const claimPeriod = 30 * 24 * 60 * 60; // 30 days for claim period

  // Setup fixture that deploys all contracts and sets them up
  async function setupFixture() {
    console.log("\n=== SETUP: Deploying contracts ===");

    // Get signers
    [deployer, auditor, generalContractor, client, investor1, investor2, investor3, energyProvider] =
      await ethers.getSigners();

    console.log(`Deployer: ${await deployer.getAddress()}`);
    console.log(`Auditor: ${await auditor.getAddress()}`);
    console.log(`General Contractor: ${await generalContractor.getAddress()}`);
    console.log(`Client: ${await client.getAddress()}`);
    console.log(`Investor 1: ${await investor1.getAddress()}`);
    console.log(`Investor 2: ${await investor2.getAddress()}`);
    console.log(`Investor 3: ${await investor3.getAddress()}`);

    // Deploy tokens
    console.log("\nDeploying token contracts...");

    const SecurityToken = await ethers.getContractFactory("SecurityToken");
    securityToken = await SecurityToken.deploy("Security Token", "STKN");
    securityTokenAddress = await securityToken.getAddress();
    console.log(`SecurityToken deployed to: ${securityTokenAddress}`);

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy("Mock USDC", "MUSDC");
    mockUSDCAddress = await mockUSDC.getAddress();
    console.log(`MockUSDC deployed to: ${mockUSDCAddress}`);

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyToken.deploy("Energy Token", "ETKN");
    energyTokenAddress = await energyToken.getAddress();
    console.log(`EnergyToken deployed to: ${energyTokenAddress}`);

    // Set up investment period from now
    const currentTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
    const endInvestmentPeriod = currentTimestamp + investmentPeriod;
    console.log(`\nSetting investment period to end at: ${new Date(endInvestmentPeriod * 1000).toLocaleString()}`);

    // Deploy CrowdFunding contract
    console.log("\nDeploying CrowdFunding contract...");
    const CrowdFunding = await ethers.getContractFactory("CrowdFunding");
    crowdFunding = await CrowdFunding.deploy(
      securityTokenAddress,
      mockUSDCAddress,
      energyTokenAddress,
      endInvestmentPeriod,
      targetAmount,
      await auditor.getAddress(),
      await generalContractor.getAddress(),
      await client.getAddress(),
      milestoneAmounts,
      claimPeriod,
    );
    crowdFundingAddress = await crowdFunding.getAddress();
    console.log(`CrowdFunding deployed to: ${crowdFundingAddress}`);

    // Set up permissions and initial token balances
    console.log("\nSetting up permissions and minting initial tokens...");

    await energyToken.grantRole(await energyToken.MINTER_ROLE(), crowdFundingAddress);
    console.log(`Granted MINTER_ROLE to CrowdFunding contract`);

    await crowdFunding.setEnergyProvider(await energyProvider.getAddress());
    console.log(`Set energy provider to: ${await energyProvider.getAddress()}`);

    // Mint tokens for tests
    await securityToken.mint(await client.getAddress(), targetAmount);
    console.log(`Minted ${ethers.formatEther(targetAmount)} security tokens to client`);

    const investAmount = ethers.parseEther("500");
    await mockUSDC.mint(await investor1.getAddress(), investAmount);
    await mockUSDC.mint(await investor2.getAddress(), investAmount);
    await mockUSDC.mint(await investor3.getAddress(), investAmount);
    console.log(`Minted ${ethers.formatEther(investAmount)} USDC to each investor`);

    console.log("=== SETUP COMPLETE ===\n");
  }

  beforeEach(async () => {
    await setupFixture();
  });

  describe("Basic Contract Setup", function () {
    it("should initialize with the correct parameters", async function () {
      console.log("\n=== TESTING: Basic Contract Setup ===");

      console.log("Verifying contract parameters...");
      expect(await crowdFunding.securityToken()).to.equal(securityTokenAddress);
      expect(await crowdFunding.mockUSDC()).to.equal(mockUSDCAddress);
      expect(await crowdFunding.energyToken()).to.equal(energyTokenAddress);
      expect(await crowdFunding.auditor()).to.equal(await auditor.getAddress());
      expect(await crowdFunding.generalContractor()).to.equal(await generalContractor.getAddress());
      expect(await crowdFunding.client()).to.equal(await client.getAddress());
      expect(await crowdFunding.energyProvider()).to.equal(await energyProvider.getAddress());

      const proposal = await crowdFunding.proposal();
      expect(proposal.targetAmount).to.equal(targetAmount);
      console.log(`Target amount: ${ethers.formatEther(proposal.targetAmount)} ETH`);

      expect(await crowdFunding.fundingStatus()).to.equal(0); // Active
      console.log(`Funding status: Active (${await crowdFunding.fundingStatus()})`);

      expect(await crowdFunding.getMilestoneCount()).to.equal(3);
      console.log(`Milestone count: ${await crowdFunding.getMilestoneCount()}`);

      for (let i = 0; i < 3; i++) {
        const milestone = await crowdFunding.getMilestoneDetails(i);
        console.log(
          `Milestone ${i}: ${ethers.formatEther(milestone.amount)} ETH, verified: ${milestone.verified}, funds released: ${milestone.fundsReleased}`,
        );
      }

      console.log("=== BASIC SETUP TEST COMPLETE ===\n");
    });
  });

  describe("Complete Funding Workflow", function () {
    it("should execute the complete crowdfunding workflow successfully", async function () {
      console.log("\n=== TESTING: Complete Crowdfunding Workflow ===");

      // Step 1: Client pledges security tokens
      console.log("\n--- STEP 1: Client pledges security tokens ---");
      console.log(`Client approving ${ethers.formatEther(targetAmount)} security tokens to CrowdFunding contract...`);
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);

      console.log("Client pledging tokens to CrowdFunding contract...");
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Verify tokens are pledged
      expect(await crowdFunding.tokensPledged()).to.equal(true);
      console.log("Tokens successfully pledged: ", await crowdFunding.tokensPledged());
      console.log(
        "Security token balance of CrowdFunding contract: ",
        ethers.formatEther(await securityToken.balanceOf(crowdFundingAddress)),
      );

      // Step 2: Investors invest in the project
      console.log("\n--- STEP 2: Investors invest in the project ---");
      const investAmount1 = ethers.parseEther("300");
      const investAmount2 = ethers.parseEther("400");
      const investAmount3 = ethers.parseEther("300");

      console.log(`Investor 1 approving ${ethers.formatEther(investAmount1)} USDC for investment...`);
      await mockUSDC.connect(investor1).approve(crowdFundingAddress, investAmount1);

      console.log(`Investor 2 approving ${ethers.formatEther(investAmount2)} USDC for investment...`);
      await mockUSDC.connect(investor2).approve(crowdFundingAddress, investAmount2);

      console.log(`Investor 3 approving ${ethers.formatEther(investAmount3)} USDC for investment...`);
      await mockUSDC.connect(investor3).approve(crowdFundingAddress, investAmount3);

      console.log("Investor 1 investing...");
      await crowdFunding.connect(investor1).invest(investAmount1);
      console.log(`Funds raised so far: ${ethers.formatEther(await crowdFunding.fundsRaised())} USDC`);

      console.log("Investor 2 investing...");
      await crowdFunding.connect(investor2).invest(investAmount2);
      console.log(`Funds raised so far: ${ethers.formatEther(await crowdFunding.fundsRaised())} USDC`);

      console.log("Investor 3 investing (this should trigger funding success)...");
      await crowdFunding.connect(investor3).invest(investAmount3);

      // Verify funding is successful
      expect(await crowdFunding.fundingStatus()).to.equal(1); // Successful
      console.log(`Funding status: ${await crowdFunding.fundingStatus()} (Successful)`);
      console.log(`Total funds raised: ${ethers.formatEther(await crowdFunding.fundsRaised())} USDC`);
      console.log(`Energy tokens released: ${await crowdFunding.energyTokensReleased()}`);

      // Step 3: Investors claim energy tokens
      console.log("\n--- STEP 3: Investors claim energy tokens ---");

      console.log("Investor 1 claiming energy tokens...");
      await crowdFunding.connect(investor1).claimEnergyTokens();
      console.log(
        `Investor 1 energy token balance: ${ethers.formatEther(await energyToken.balanceOf(await investor1.getAddress()))} ETKN`,
      );

      console.log("Investor 2 claiming energy tokens...");
      await crowdFunding.connect(investor2).claimEnergyTokens();
      console.log(
        `Investor 2 energy token balance: ${ethers.formatEther(await energyToken.balanceOf(await investor2.getAddress()))} ETKN`,
      );

      console.log("Investor 3 claiming energy tokens...");
      await crowdFunding.connect(investor3).claimEnergyTokens();
      console.log(
        `Investor 3 energy token balance: ${ethers.formatEther(await energyToken.balanceOf(await investor3.getAddress()))} ETKN`,
      );

      // Step 4: General contractor signs agreement
      // Step 4: General contractor signs agreement
      console.log("\n--- STEP 4: General contractor signs agreement ---");

      const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("Agreement terms"));
      console.log(`Agreement hash: ${agreementHash}`);

      // Create and sign the message using EIP-712
      const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();
      console.log(`Domain separator: ${domainSeparator}`);

      const messageHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "address", "uint256"],
          [agreementHash, crowdFundingAddress, (await ethers.provider.getNetwork()).chainId],
        ),
      );
      console.log(`Message hash: ${messageHash}`);

      // Create the EIP-712 digest
      const digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
      console.log(`Digest to sign: ${digest}`);

      // SIMPLEST SOLUTION FOR HARDHAT:
      // In Hardhat tests, we can use a known private key for the generalContractor signer

      // The private keys for default Hardhat accounts (DO NOT USE THESE IN PRODUCTION!)
      const HARDHAT_PRIVATE_KEYS = [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
        "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // account #4
        "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // account #5
        "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // account #6
        "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // account #7
      ];

      // Find the index of the generalContractor in the signers array
      let gcIndex = -1;
      for (let i = 0; i < 8; i++) {
        if ((await ethers.getSigners())[i].address === (await generalContractor.getAddress())) {
          gcIndex = i;
          break;
        }
      }

      console.log(`General contractor is account #${gcIndex}`);
      // Use the corresponding private key from the known Hardhat accounts
      const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];

      // Create a wallet with the private key
      const wallet = new ethers.Wallet(gcPrivateKey);
      console.log(`Created wallet from private key: ${wallet.address}`);

      // Sign the digest directly without the Ethereum Signed Message prefix
      const signature = wallet.signingKey.sign(digest);
      console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

      // Format the signature as expected by the contract
      const flatSig = ethers.concat([
        signature.r,
        signature.s,
        signature.v === 27 ? "0x1b" : "0x1c", // v needs to be 0x1b or 0x1c bytes
      ]);
      console.log(`Formatted signature: ${flatSig}`);

      console.log("General contractor signing agreement...");
      await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);

      // Verify agreement is signed
      expect(await crowdFunding.gcAgreement()).to.equal(true);
      console.log(`Agreement signed: ${await crowdFunding.gcAgreement()}`);

      // Step 5: Verify milestones and withdraw funds
      console.log("\n--- STEP 5: Verify milestones and withdraw funds ---");

      // Verify first milestone
      console.log("Auditor verifying milestone 0...");
      await crowdFunding.connect(auditor).verifyMilestone(0);

      // Verify milestone is marked as verified
      const milestone0 = await crowdFunding.getMilestoneDetails(0);
      console.log(`Milestone 0 verified: ${milestone0.verified}`);

      // General contractor withdraws funds for first milestone
      console.log(`General contractor withdrawing ${ethers.formatEther(milestone0.amount)} USDC for milestone 0...`);
      await crowdFunding.connect(generalContractor).withdrawByGC(0);

      // Verify funds are released
      const milestone0AfterWithdraw = await crowdFunding.getMilestoneDetails(0);
      console.log(`Milestone 0 funds released: ${milestone0AfterWithdraw.fundsReleased}`);
      console.log(
        `General contractor USDC balance: ${ethers.formatEther(await mockUSDC.balanceOf(await generalContractor.getAddress()))} USDC`,
      );

      // Step 6: Request extra funds, get approval, voting, and execution
      console.log("\n--- STEP 6: Extra fund request, voting, and execution ---");

      const proposalHash = ethers.keccak256(ethers.toUtf8Bytes("Extra fund proposal"));
      const extraFundAmount = ethers.parseEther("100");
      const description = "Need extra funds for unexpected costs";

      console.log(`General contractor requesting ${ethers.formatEther(extraFundAmount)} USDC extra funds...`);
      await crowdFunding.connect(generalContractor).requestExtraFunds(proposalHash, extraFundAmount, description);

      console.log("Extra fund request created with ID 0");

      // Auditor approves the request and sets voting period
      const votingDuration = 5 * 24 * 60 * 60; // 5 days
      console.log(`Auditor approving extra fund request with ${votingDuration / 86400} days voting period...`);
      await crowdFunding.connect(auditor).approveExtraFundRequest(0, votingDuration);

      // Investors vote on the request
      console.log("Investors voting on extra fund request...");

      console.log(`Investor 1 voting IN FAVOR with ${ethers.formatEther(investAmount1)} voting power...`);
      await crowdFunding.connect(investor1).voteOnExtraFundRequest(0, true);

      console.log(`Investor 2 voting IN FAVOR with ${ethers.formatEther(investAmount2)} voting power...`);
      await crowdFunding.connect(investor2).voteOnExtraFundRequest(0, true);

      console.log(`Investor 3 voting AGAINST with ${ethers.formatEther(investAmount3)} voting power...`);
      await crowdFunding.connect(investor3).voteOnExtraFundRequest(0, false);

      console.log("Votes tallied. Getting request details...");
      const requestDetails = await crowdFunding.getExtraFundRequestDetails(0);
      console.log(`Votes for: ${ethers.formatEther(requestDetails.votesFor)} USDC`);
      console.log(`Votes against: ${ethers.formatEther(requestDetails.votesAgainst)} USDC`);

      // Fast forward time to end voting period
      console.log(`Fast-forwarding time by ${votingDuration + 1} seconds to end voting period...`);
      await time.increase(votingDuration + 1);

      // Execute the extra fund request
      console.log("Auditor executing the extra fund request...");
      await crowdFunding.connect(auditor).executeExtraFundRequest(0);

      // Verify request is executed
      const request = await crowdFunding.getExtraFundRequestDetails(0);
      console.log(`Request executed: ${request.executed}`);
      console.log(
        `General contractor USDC balance after extra funds: ${ethers.formatEther(await mockUSDC.balanceOf(await generalContractor.getAddress()))} USDC`,
      );

      // Step 7: Complete remaining milestones
      console.log("\n--- STEP 7: Complete remaining milestones ---");

      // Verify second milestone
      console.log("Auditor verifying milestone 1...");
      await crowdFunding.connect(auditor).verifyMilestone(1);
      const milestone1 = await crowdFunding.getMilestoneDetails(1);
      console.log(`Milestone 1 verified: ${milestone1.verified}`);

      // General contractor withdraws funds for second milestone
      console.log(`General contractor withdrawing ${ethers.formatEther(milestone1.amount)} USDC for milestone 1...`);
      await crowdFunding.connect(generalContractor).withdrawByGC(1);
      console.log(
        `General contractor USDC balance: ${ethers.formatEther(await mockUSDC.balanceOf(await generalContractor.getAddress()))} USDC`,
      );

      // Verify final milestone
      console.log("Auditor verifying final milestone (2)...");
      await crowdFunding.connect(auditor).verifyMilestone(2);
      const milestone2 = await crowdFunding.getMilestoneDetails(2);
      console.log(`Final milestone verified: ${milestone2.verified}`);
      console.log(`Final milestone achieved: ${await crowdFunding.finalMilestoneAchieved()}`);

      // General contractor withdraws funds for final milestone
      console.log(
        `General contractor withdrawing ${ethers.formatEther(milestone2.amount)} USDC for final milestone...`,
      );
      await crowdFunding.connect(generalContractor).withdrawByGC(2);
      console.log(
        `General contractor USDC balance: ${ethers.formatEther(await mockUSDC.balanceOf(await generalContractor.getAddress()))} USDC`,
      );

      // Complete the final milestone (auditor marks it as complete)
      console.log("Auditor completing the final milestone...");
      await crowdFunding.connect(auditor).completeFinalMilestone();
      console.log(`Final milestone completed: ${await crowdFunding.finalMilestoneAchieved()}`);

      // Step 8: Energy credit redemption
      console.log("\n--- STEP 8: Energy credit redemption ---");

      // Update energy credit rate
      console.log("Owner updating energy credit rate to 2...");
      await crowdFunding.connect(deployer).setEnergyCreditRate(2);
      console.log(`New energy credit rate: ${await crowdFunding.energyCreditRate()}`);

      const burnAmount = ethers.parseEther("100");

      // Investor burns energy tokens to claim credits
      console.log(`Investor 1 approving ${ethers.formatEther(burnAmount)} energy tokens for burning...`);
      await energyToken.connect(investor1).approve(crowdFundingAddress, burnAmount);

      console.log(`Investor 1 burning energy tokens and claiming credits...`);
      await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(burnAmount);

      console.log(
        `Investor 1 energy token balance after burn: ${ethers.formatEther(await energyToken.balanceOf(await investor1.getAddress()))} ETKN`,
      );

      // Energy provider verifies the redemption
      console.log("Energy provider verifying redemption...");
      await crowdFunding.connect(energyProvider).verifyEnergyCreditRedemption(await investor1.getAddress());

      // Verify redemption details
      const redemptionDetails = await crowdFunding
        .connect(investor1)
        .getEnergyCreditRedemptionDetails(await investor1.getAddress());
      console.log("Energy credit redemption details:");
      console.log(`Tokens burned: ${ethers.formatEther(redemptionDetails.tokensBurned)} ETKN`);
      console.log(`Credits earned: ${ethers.formatEther(redemptionDetails.creditsEarned)} credits`);
      console.log(`Verified by provider: ${redemptionDetails.verified}`);
      console.log(`Redeemed: ${redemptionDetails.redeemed}`);

      console.log("\n=== COMPLETE WORKFLOW TEST FINISHED SUCCESSFULLY ===\n");
    });

    it("should not allow investing after investment period ends", async function () {
      console.log("\n=== TESTING: Investment Period Enforcement ===");

      // Client pledges security tokens
      console.log("Client pledging security tokens...");
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Fast forward time past investment period
      console.log(`Fast-forwarding time by ${investmentPeriod + 1} seconds (past investment period)...`);
      await time.increase(investmentPeriod + 1);

      // Try to invest
      const investAmount = ethers.parseEther("100");
      await mockUSDC.connect(investor1).approve(crowdFundingAddress, investAmount);

      console.log("Investor 1 attempting to invest after period end (should fail)...");
      await expect(crowdFunding.connect(investor1).invest(investAmount)).to.be.revertedWith(
        "INVEST: Investment period has ended",
      );

      console.log("Investment correctly rejected after investment period ended");
      console.log("=== INVESTMENT PERIOD TEST COMPLETE ===\n");
    });

    it("should allow refund claims if funding fails", async function () {
      console.log("\n=== TESTING: Refund Mechanism ===");

      // Client pledges security tokens
      console.log("Client pledging security tokens...");
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Investor invests a small amount
      const investAmount = ethers.parseEther("100");
      console.log(`Investor 1 investing ${ethers.formatEther(investAmount)} USDC...`);
      await mockUSDC.connect(investor1).approve(crowdFundingAddress, investAmount);
      await crowdFunding.connect(investor1).invest(investAmount);

      console.log(`Funds raised: ${ethers.formatEther(await crowdFunding.fundsRaised())} USDC (less than target)`);

      // Fast forward time past investment period to make funding fail
      console.log(`Fast-forwarding time by ${investmentPeriod + 1} seconds to end investment period...`);
      await time.increase(investmentPeriod + 1);

      // Call updateFundingStatus to update the status
      console.log("Updating funding status...");
      await crowdFunding.updateFundingStatus();

      // Verify funding failed
      expect(await crowdFunding.fundingStatus()).to.equal(2); // 2 is Failed
      console.log(`Funding status: ${await crowdFunding.fundingStatus()} (Failed)`);

      console.log("Investor 1 claiming refund...");
      await crowdFunding.connect(investor1).claimRefund();

      // Verify investor received funds back
      const investorBalance = await mockUSDC.balanceOf(await investor1.getAddress());
      console.log(`Investor 1 USDC balance after refund: ${ethers.formatEther(investorBalance)} USDC`);
      expect(investorBalance).to.equal(investAmount);

      console.log("Refund successfully claimed");
      console.log("=== REFUND TEST COMPLETE ===\n");
    });

    it("should respect emergency stops", async function () {
      console.log("\n=== TESTING: Emergency Stop ===");

      // Client pledges security tokens
      console.log("Client pledging security tokens...");
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Owner enables emergency stop
      console.log("Owner enabling emergency stop...");
      await crowdFunding.connect(deployer).toggleEmergencyStop();
      console.log(`Emergency stop active: ${await crowdFunding.emergencyStop()}`);

      // Try to invest
      const investAmount = ethers.parseEther("100");
      console.log(`Investor 1 approving ${ethers.formatEther(investAmount)} USDC...`);
      await mockUSDC.connect(investor1).approve(crowdFundingAddress, investAmount);

      console.log("Investor 1 attempting to invest during emergency stop (should fail)...");
      await expect(crowdFunding.connect(investor1).invest(investAmount)).to.be.revertedWith(
        "Contract is in emergency stop",
      );

      // Owner disables emergency stop
      console.log("Owner disabling emergency stop...");
      await crowdFunding.connect(deployer).toggleEmergencyStop();
      console.log(`Emergency stop active: ${await crowdFunding.emergencyStop()}`);

      // Investment should work now
      console.log("Investor 1 investing after emergency stop lifted...");
      await crowdFunding.connect(investor1).invest(investAmount);

      // Verify investment went through
      console.log(
        `Investor 1 balance in contract: ${ethers.formatEther(await crowdFunding.investorBalances(await investor1.getAddress()))} USDC`,
      );
      console.log(`Total funds raised: ${ethers.formatEther(await crowdFunding.fundsRaised())} USDC`);

      console.log("Emergency stop mechanism working correctly");
      console.log("=== EMERGENCY STOP TEST COMPLETE ===\n");
    });

    it("should enforce access control", async function () {
      console.log("\n=== TESTING: Access Control ===");

      // Client pledges security tokens
      console.log("Client pledging security tokens...");
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Attempt to call client-only function
      console.log("Investor 1 attempting to call client-only function (should fail)...");
      await expect(crowdFunding.connect(investor1).pledgeTokens(targetAmount)).to.be.revertedWith(
        "Only client can call this function",
      );

      // Attempt to call auditor-only function
      console.log("Investor 1 attempting to call auditor-only function (should fail)...");
      await expect(crowdFunding.connect(investor1).verifyMilestone(0)).to.be.revertedWith(
        "Only auditor can call this function",
      );

      // Attempt to call general contractor-only function
      console.log("Investor 1 attempting to call general contractor-only function (should fail)...");
      await expect(crowdFunding.connect(investor1).withdrawByGC(0)).to.be.revertedWith(
        "Only general contractor can call this function",
      );

      // Attempt to call energy provider-only function
      console.log("Investor 1 attempting to call energy provider-only function (should fail)...");
      await expect(
        crowdFunding.connect(investor1).verifyEnergyCreditRedemption(await investor1.getAddress()),
      ).to.be.revertedWith("Only energy provider can call this function");

      console.log("Access control working correctly");
      console.log("=== ACCESS CONTROL TEST COMPLETE ===\n");
    });

    it("should accumulate energy credits correctly for multiple burns", async function () {
      console.log("\n=== TESTING: Energy Credit Accumulation ===");

      // Setup for energy credit testing
      console.log("Setting up for energy credit testing...");

      // Client pledges security tokens
      console.log("Client pledging security tokens...");
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Investors fully fund the project
      const investAmount = ethers.parseEther("500");
      console.log(`Investors funding the project with ${ethers.formatEther(investAmount)} USDC each...`);
      await mockUSDC.connect(investor1).approve(crowdFundingAddress, investAmount);
      await mockUSDC.connect(investor2).approve(crowdFundingAddress, investAmount);
      await crowdFunding.connect(investor1).invest(investAmount);
      await crowdFunding.connect(investor2).invest(investAmount);

      // Investor claims energy tokens
      console.log("Investor 1 claiming energy tokens...");
      await crowdFunding.connect(investor1).claimEnergyTokens();
      console.log(
        `Investor 1 energy token balance: ${ethers.formatEther(await energyToken.balanceOf(await investor1.getAddress()))} ETKN`,
      );

      // Sign agreement
      console.log("General contractor signing agreement...");
      const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("Agreement terms"));
      const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();
      const messageHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "address", "uint256"],
          [agreementHash, crowdFundingAddress, (await ethers.provider.getNetwork()).chainId],
        ),
      );
      const digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
      const signature = await generalContractor.signMessage(ethers.getBytes(digest));
      await crowdFunding.connect(generalContractor).signAgreement(agreementHash, signature);

      // Verify and complete all milestones
      console.log("Auditor verifying and completing all milestones...");
      await crowdFunding.connect(auditor).verifyMilestone(0);
      await crowdFunding.connect(auditor).verifyMilestone(1);
      await crowdFunding.connect(auditor).verifyMilestone(2);
      await crowdFunding.connect(auditor).completeFinalMilestone();
      console.log("All milestones completed");

      // Set energy credit rate to 2
      console.log("Setting energy credit rate to 2...");
      await crowdFunding.connect(deployer).setEnergyCreditRate(2);
      console.log(`Energy credit rate: ${await crowdFunding.energyCreditRate()}`);

      // First burn
      const burnAmount1 = ethers.parseEther("100");
      console.log(`Investor 1 burning ${ethers.formatEther(burnAmount1)} ETKN (first burn)...`);
      await energyToken.connect(investor1).approve(crowdFundingAddress, burnAmount1);
      await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(burnAmount1);

      // Get redemption details after first burn
      const redemptionAfterFirstBurn = await crowdFunding
        .connect(investor1)
        .getEnergyCreditRedemptionDetails(await investor1.getAddress());
      console.log("After first burn:");
      console.log(`Tokens burned: ${ethers.formatEther(redemptionAfterFirstBurn.tokensBurned)} ETKN`);
      console.log(`Credits earned: ${ethers.formatEther(redemptionAfterFirstBurn.creditsEarned)} credits`);

      // Second burn
      const burnAmount2 = ethers.parseEther("50");
      console.log(`Investor 1 burning ${ethers.formatEther(burnAmount2)} ETKN (second burn)...`);
      await energyToken.connect(investor1).approve(crowdFundingAddress, burnAmount2);
      await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(burnAmount2);

      // Check accumulated credits
      const redemptionDetails = await crowdFunding
        .connect(investor1)
        .getEnergyCreditRedemptionDetails(await investor1.getAddress());
      console.log("After second burn:");
      console.log(`Tokens burned: ${ethers.formatEther(redemptionDetails.tokensBurned)} ETKN`);
      console.log(`Credits earned: ${ethers.formatEther(redemptionDetails.creditsEarned)} credits`);

      // Verify accumulation is working correctly
      expect(redemptionDetails.tokensBurned).to.equal(burnAmount1 + burnAmount2);
      expect(redemptionDetails.creditsEarned).to.equal((burnAmount1 + burnAmount2) * BigInt(2));

      console.log("Energy credit accumulation working correctly");
      console.log(`Total tokens burned: ${ethers.formatEther(redemptionDetails.tokensBurned)} ETKN`);
      console.log(`Total credits earned: ${ethers.formatEther(redemptionDetails.creditsEarned)} credits (at 2x rate)`);

      console.log("=== ENERGY CREDIT ACCUMULATION TEST COMPLETE ===\n");
    });
  });
});
// import { expect } from 'chai';
// import { ethers } from 'hardhat';
// import { Signer } from 'ethers';  // Import the Signer type

// describe('CrowdFunding Contract Integration Test', function () {
//   let owner: Signer, client: Signer, auditor: Signer, generalContractor: Signer, investor1: Signer, investor2: Signer;
//   let crowdFundingContract: any, securityTokenContract: any, mockUSDCContract: any, energyTokenContract: any;

//   // Milestone amounts
//   const milestoneAmounts = [
//     ethers.parseUnits('10000', 6),   // First milestone
//     ethers.parseUnits('15000', 6),   // Second milestone
//     ethers.parseUnits('25000', 6)    // Final milestone
//   ];
//   const TARGET_AMOUNT = milestoneAmounts.reduce((a, b) => a + b, 0n);
//   if (milestoneAmounts.reduce((a, b) => a + b, 0n) !== TARGET_AMOUNT) {
//     throw new Error("Sum of milestone amounts must equal SecurityAmount.");
//   }

//   const investmentPeriod = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
//   const claimPeriod = 86400 * 14; // 14 days
//   const maxVotingPeriod = 86400 * 7; // 7 days
//   const initialSupply_SecurityToken = ethers.parseEther("50000"); // Increased initial supply
//   const initialSupply_mockUSDC = ethers.parseEther("100000"); // Increased initial supply

//   beforeEach(async function () {
//     // Get signers
//     [owner, client, auditor, generalContractor, investor1, investor2] = await ethers.getSigners();

//     // Deploy mock USDC token
//     const MockUSDC = await ethers.getContractFactory('MockUSDC');
//     mockUSDCContract = await MockUSDC.deploy(initialSupply_mockUSDC);
//     await mockUSDCContract.waitForDeployment();

//     // Deploy security token
//     const SecurityToken = await ethers.getContractFactory('SecurityToken', client);
//     securityTokenContract = await SecurityToken.deploy(initialSupply_SecurityToken);
//     await securityTokenContract.waitForDeployment();

//     // Deploy energy token
//     const EnergyToken = await ethers.getContractFactory('EnergyToken');
//     energyTokenContract = await EnergyToken.deploy('Energy Credit Token', 'ECT');
//     await energyTokenContract.waitForDeployment();

//     // Deploy CrowdFunding contract
//     const CrowdFunding = await ethers.getContractFactory('CrowdFunding');
//     crowdFundingContract = await CrowdFunding.deploy();
//     await crowdFundingContract.waitForDeployment();

//     // Grant roles and mint tokens
//     // await securityTokenContract.
//     // mint(await client.getAddress(), TARGET_AMOUNT);
//     // await mockUSDCContract.mint(investor1, TARGET_AMOUNT);
//     // await mockUSDCContract.mint(investor2, TARGET_AMOUNT);
//     await mockUSDCContract.transfer(investor1, ethers.parseEther("1000"));
//     await mockUSDCContract.transfer(investor2, ethers.parseEther("1000"));
//     await securityTokenContract.transfer(client, TARGET_AMOUNT);

//     // Approve tokens
//     await securityTokenContract.connect(client).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT);
//     await mockUSDCContract.connect(investor1).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT);
//     await mockUSDCContract.connect(investor2).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT);
//   });

//   describe('Constructor', function () {
//       it('should set initial state to zero/default values', async function () {
//         // Check initial state after constructor
//         expect(await crowdFundingContract.auditor()).to.equal(ethers.ZeroAddress);
//         expect(await crowdFundingContract.generalContractor()).to.equal(ethers.ZeroAddress);
//         expect(await crowdFundingContract.client()).to.equal(ethers.ZeroAddress);

//         // Check token addresses
//         expect(await crowdFundingContract.securityToken()).to.equal(ethers.ZeroAddress);
//         expect(await crowdFundingContract.mockUSDC()).to.equal(ethers.ZeroAddress);
//         expect(await crowdFundingContract.energyToken()).to.equal(ethers.ZeroAddress);

//         // Check funding status
//         const fundingStatus = await crowdFundingContract.fundingStatus();
//         expect(fundingStatus).to.equal(0); // Assuming Active is the first enum value

//         // Check domain separator
//         const domainSeparator = await crowdFundingContract.DOMAIN_SEPARATOR();
//         expect(domainSeparator).to.equal(ethers.zeroPadBytes('0x', 32));
//       });

//       it('should set the contract owner', async function () {
//         expect(await crowdFundingContract.owner()).to.equal(owner);
//       });
//     });

//     describe('Initialization', function () {
//       it('should initialize contract with correct parameters', async function () {
//         // Initialize the contract
//         await crowdFundingContract.initialize(
//           await securityTokenContract.getAddress(),
//           await mockUSDCContract.getAddress(),
//           await energyTokenContract.getAddress(),
//           investmentPeriod,
//           TARGET_AMOUNT,
//           await auditor.getAddress(),
//           await generalContractor.getAddress(),
//           await client.getAddress(),
//           milestoneAmounts,
//           claimPeriod,
//           maxVotingPeriod
//         );

//         // Verify token addresses
//         expect(await crowdFundingContract.securityToken()).to.equal(await securityTokenContract.getAddress());
//         expect(await crowdFundingContract.mockUSDC()).to.equal(await mockUSDCContract.getAddress());
//         expect(await crowdFundingContract.energyToken()).to.equal(await energyTokenContract.getAddress());

//         // Verify actors
//         expect(await crowdFundingContract.auditor()).to.equal(await auditor.getAddress());
//         expect(await crowdFundingContract.generalContractor()).to.equal(await generalContractor.getAddress());
//         expect(await crowdFundingContract.client()).to.equal(await client.getAddress());

//         // Verify proposal details
//         const proposal = await crowdFundingContract.proposal();
//         expect(proposal.investmentPeriod).to.equal(investmentPeriod);
//         expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);

//         // Verify milestones
//         const milestoneCount = await crowdFundingContract.getMilestoneCount();
//         expect(milestoneCount).to.equal(milestoneAmounts.length);

//         // Check each milestone
//         for (let i = 0; i < milestoneAmounts.length; i++) {
//           const [amount, verified, fundsReleased] = await crowdFundingContract.getMilestoneDetails(i);
//           expect(amount).to.equal(milestoneAmounts[i]);
//           expect(verified).to.be.false;
//           expect(fundsReleased).to.be.false;
//         }

//         // Verify additional parameters
//         expect(await crowdFundingContract.CLAIM_PERIOD()).to.equal(claimPeriod);
//         expect(await crowdFundingContract.MAX_VOTING_PERIOD()).to.equal(maxVotingPeriod);

//         // Verify funding status
//         const fundingStatus = await crowdFundingContract.fundingStatus();
//         expect(fundingStatus).to.equal(0); // Assuming Active is the first enum value
//       });

//       it('should prevent initialization by non-owner', async function () {
//         // Try to initialize with a different account
//         await expect(
//           crowdFundingContract.connect(client).initialize(
//             await securityTokenContract.getAddress(),
//             await mockUSDCContract.getAddress(),
//             await energyTokenContract.getAddress(),
//             investmentPeriod,
//             TARGET_AMOUNT,
//             await auditor.getAddress(),
//             await generalContractor.getAddress(),
//             await client.getAddress(),
//             milestoneAmounts,
//             claimPeriod,
//             maxVotingPeriod
//           )
//         ).to.be.revertedWithCustomError(crowdFundingContract, 'OwnableUnauthorizedAccount');
//       });

//       it('should prevent double initialization', async function () {
//         // First initialization
//         await crowdFundingContract.initialize(
//           await securityTokenContract.getAddress(),
//           await mockUSDCContract.getAddress(),
//           await energyTokenContract.getAddress(),
//           investmentPeriod,
//           TARGET_AMOUNT,
//           await auditor.getAddress(),
//           await generalContractor.getAddress(),
//           await client.getAddress(),
//           milestoneAmounts,
//           claimPeriod,
//           maxVotingPeriod
//         );

//         // Try to initialize again
//         await expect(
//           crowdFundingContract.initialize(
//             await securityTokenContract.getAddress(),
//             await mockUSDCContract.getAddress(),
//             await energyTokenContract.getAddress(),
//             investmentPeriod,
//             TARGET_AMOUNT,
//             await auditor.getAddress(),
//             await generalContractor.getAddress(),
//             await client.getAddress(),
//             milestoneAmounts,
//             claimPeriod,
//             maxVotingPeriod
//           )
//         ).to.be.revertedWith('Initializable: contract is already initialized');
//       });

//       it('should prevent initialization with invalid parameters', async function () {
//         // Test zero address for security token
//         await expect(
//           crowdFundingContract.initialize(
//             ethers.ZeroAddress,
//             await mockUSDCContract.getAddress(),
//             await energyTokenContract.getAddress(),
//             investmentPeriod,
//             TARGET_AMOUNT,
//             await auditor.getAddress(),
//             await generalContractor.getAddress(),
//             await client.getAddress(),
//             milestoneAmounts,
//             claimPeriod,
//             maxVotingPeriod
//           )
//         ).to.be.revertedWith('Security token cannot be zero address');

//         // Test investment period in the past
//         await expect(
//           crowdFundingContract.initialize(
//             await securityTokenContract.getAddress(),
//             await mockUSDCContract.getAddress(),
//             await energyTokenContract.getAddress(),
//             Math.floor(Date.now() / 1000) - 86400, // Yesterday
//             TARGET_AMOUNT,
//             await auditor.getAddress(),
//             await generalContractor.getAddress(),
//             await client.getAddress(),
//             milestoneAmounts,
//             claimPeriod,
//             maxVotingPeriod
//           )
//         ).to.be.revertedWith('Investment period must be in the future');

//         // Test zero target amount
//         await expect(
//           crowdFundingContract.initialize(
//             await securityTokenContract.getAddress(),
//             await mockUSDCContract.getAddress(),
//             await energyTokenContract.getAddress(),
//             investmentPeriod,
//             0,
//             auditor,
//             generalContractor,
//             client,
//             milestoneAmounts,
//             claimPeriod,
//             maxVotingPeriod
//           )
//         ).to.be.revertedWith('Target amount must be greater than zero');
//       });
//     });

//     describe('Token Pledging', function () {
//       it('should allow client to pledge security tokens', async function () {
//         // Ensure client has enough tokens
//         await securityTokenContract.transfer(client, TARGET_AMOUNT);

//         // Allow the contract to transfer tokens on behalf of the client
//         await securityTokenContract.connect(client).approve(crowdFundingContract.address, TARGET_AMOUNT);

//         // Now pledge the tokens
//         await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);

//         // Check if tokens were pledged successfully
//         expect(await crowdFundingContract.tokensPledged()).to.be.true;
//       });
//   });

//   describe('Investment Flow', function () {
//     beforeEach(async function () {
//       // Pledge tokens before investment
//       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
//     });

//     it('should allow investments and track balances', async function () {
//       const investAmount1 = ethers.parseUnits('20000', 6);
//       const investAmount2 = ethers.parseUnits('25000', 6);

//       // First investor invests
//       await crowdFundingContract.connect(investor1).invest(investAmount1);
//       expect(await crowdFundingContract.investorBalances(investor1)).to.equal(investAmount1);
//       expect(await crowdFundingContract.fundsRaised()).to.equal(investAmount1);

//       // Second investor invests
//       await crowdFundingContract.connect(investor2).invest(investAmount2);
//       expect(await crowdFundingContract.investorBalances(investor2)).to.equal(investAmount2);
//       expect(await crowdFundingContract.fundsRaised()).to.equal(investAmount1 + investAmount2);
//     });

//     it('should prevent investing after funding period', async function () {
//       // Simulate time passing
//       await ethers.provider.send('evm_increaseTime', [86400 * 31]); // 31 days
//       await ethers.provider.send('evm_mine');

//       // Try to invest
//       await expect(
//         crowdFundingContract.connect(investor1).invest(ethers.parseUnits('10000', 6))
//       ).to.be.revertedWith('INVEST: Investment period has ended');
//     });
//   });

//   describe('Milestone Verification and Fund Withdrawal', function () {
//     beforeEach(async function () {
//       // Pledge tokens and fully fund the project
//       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
//       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT);

//       // Sign agreement
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));
//       const signature = await generalContractor.signMessage(
//         ethers.getBytes(agreementHash)
//       );
//       await crowdFundingContract.connect(generalContractor).signAgreement(agreementHash, signature);
//     });

//     it('should allow auditor to verify milestones', async function () {
//       // Verify first milestone
//       await crowdFundingContract.connect(auditor).verifyMilestone(0);
//       const milestone = await crowdFundingContract.getMilestoneDetails(0);
//       expect(milestone.verified).to.be.true;

//       // General contractor withdraws funds
//       await crowdFundingContract.connect(generalContractor).withdrawByGC(0);
//       const milestoneAfterWithdraw = await crowdFundingContract.getMilestoneDetails(0);
//       expect(milestoneAfterWithdraw.fundsReleased).to.be.true;
//     });
//   });

//   describe('Extra Fund Request Flow', function () {
//     beforeEach(async function () {
//       // Pledge tokens and fully fund the project
//       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
//       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT);

//       // Sign agreement
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));
//       const signature = await generalContractor.signMessage(
//         ethers.getBytes(agreementHash)
//       );
//       await crowdFundingContract.connect(generalContractor).signAgreement(agreementHash, signature);
//     });

//     it('should allow extra fund request and voting', async function () {
//       const extraFundAmount = ethers.parseUnits('5000', 6);
//       const proposalHash = ethers.keccak256(ethers.toUtf8Bytes('Extra Fund Proposal'));

//       // General contractor requests extra funds
//       await crowdFundingContract.connect(generalContractor).requestExtraFunds(
//         proposalHash,
//         extraFundAmount,
//         'Additional materials needed'
//       );

//       // Auditor approves the request
//       await crowdFundingContract.connect(auditor).approveExtraFundRequest(0, maxVotingPeriod);

//       // Investor votes
//       await crowdFundingContract.connect(investor1).voteOnExtraFundRequest(0, true);

//       // Simulate time passing to end voting period
//       await ethers.provider.send('evm_increaseTime', [maxVotingPeriod + 1]);
//       await ethers.provider.send('evm_mine');

//       // Execute the request
//       await crowdFundingContract.connect(auditor).executeExtraFundRequest(0);

//       // Check request details
//       const requestDetails = await crowdFundingContract.getExtraFundRequestDetails(0);
//       expect(requestDetails.executed).to.be.true;
//     });
//   });

//   describe('Energy Credit Redemption', function () {
//     beforeEach(async function () {
//       // Pledge tokens and fully fund the project
//       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
//       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT);

//       // Sign agreement
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));
//       const signature = await generalContractor.signMessage(
//         ethers.getBytes(agreementHash)
//       );
//       await crowdFundingContract.connect(generalContractor).signAgreement(agreementHash, signature);

//       // Complete all milestones
//       for (let i = 0; i < milestoneAmounts.length; i++) {
//         await crowdFundingContract.connect(auditor).verifyMilestone(i);
//         await crowdFundingContract.connect(generalContractor).withdrawByGC(i);
//       }

//       // Complete final milestone and set energy provider
//       await crowdFundingContract.connect(auditor).completeFinalMilestone();
//       await crowdFundingContract.connect(owner).setEnergyProvider(auditor);
//     });

//     it('should allow burning tokens for energy credits', async function () {
//       // Mint some energy tokens to investor
//       await energyTokenContract.mint(investor1, ethers.parseUnits('1000', 18));
//       await energyTokenContract.connect(investor1).approve(crowdFundingContract.getAddress(), ethers.parseUnits('1000', 18));

//       // Burn tokens and claim credits
//       await crowdFundingContract.connect(investor1).burnAndClaimEnergyCredits(ethers.parseUnits('500', 18));

//       // Verify by energy provider
//       await crowdFundingContract.connect(auditor).verifyEnergyCreditRedemption(investor1);

//       // Get redemption details
//       const [tokensBurned, creditsEarned, redeemed, verified] =
//         await crowdFundingContract.getEnergyCreditRedemptionDetails(investor1);

//       expect(tokensBurned).to.equal(ethers.parseUnits('500', 18));
//       expect(creditsEarned).to.equal(ethers.parseUnits('500', 18));
//       expect(verified).to.be.true;
//     });
//   });
// });

// // import { expect } from 'chai';
// // import { ethers } from 'hardhat';
// // import {
// //   SignerWithAddress
// // } from '@nomicfoundation/hardhat-ethers/signers';
// // import {
// //   CrowdFunding,
// //   SecurityToken,
// //   MockUSDC,
// //   EnergyToken
// // } from '../../typechain-types';

// // describe('CrowdFunding Contract', function () {
// //   let
// //   owner: SignerWithAddress,
// //   auditor: SignerWithAddress,
// //   generalContractor: SignerWithAddress,
// //   client: SignerWithAddress,
// //   investor1: SignerWithAddress,
// //   investor2: SignerWithAddress,
// //   energyProvider: SignerWithAddress,
// //   securityToken: SecurityToken,
// //   mockUSDC: MockUSDC,
// //   energyToken: EnergyToken,
// //   crowdFundingContract: CrowdFunding;

// //   // Deployment and initialization constants
// //   const INVESTMENT_PERIOD = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
// //   const TARGET_AMOUNT = ethers.parseUnits('10000', 6); // 10,000 USDC
// //   const INITIAL_SUPPLY_mockUSD = ethers.parseUnits('1000000', 6); // 1M USDC
// //   const INITIAL_SUPPLY_securityToken = ethers.parseUnits('1000000', 6); // 1M USDC

// //   const MILESTONE_AMOUNTS = [
// //     ethers.parseUnits('3000', 6),
// //     ethers.parseUnits('4000', 6),
// //     ethers.parseUnits('3000', 6)
// //   ];
// //   const CLAIM_PERIOD = 86400 * 60; // 60 days
// //   const MAX_VOTING_PERIOD = 86400 * 7; // 7 days

// //   beforeEach(async function () {
// //     // Get signers
// //     [
// //       owner,
// //       auditor,
// //       generalContractor,
// //       client,
// //       investor1,
// //       investor2,
// //       energyProvider
// //     ] = await ethers.getSigners();

// //     // Deploy mock tokens
// //     const SecurityToken = await ethers.getContractFactory('SecurityToken');
// //     securityToken = await SecurityToken.connect(client).deploy(INITIAL_SUPPLY_securityToken);

// //     const MockUSDC = await ethers.getContractFactory('MockUSDC');
// //     mockUSDC = await MockUSDC.deploy(INITIAL_SUPPLY_mockUSD);

// //     const EnergyToken = await ethers.getContractFactory('EnergyToken');
// //     energyToken = await EnergyToken.deploy('Energy Token', 'ET');

// //     // Deploy CrowdFunding contract
// //     const CrowdFunding = await ethers.getContractFactory('CrowdFunding');
// //     crowdFundingContract = await CrowdFunding.deploy();

// //     // Initialize the contract
// //     await crowdFundingContract.initialize(
// //       await securityToken.getAddress(),
// //       await mockUSDC.getAddress(),
// //       await energyToken.getAddress(),
// //       INVESTMENT_PERIOD,
// //       TARGET_AMOUNT,
// //       await auditor.getAddress(),
// //       await generalContractor.getAddress(),
// //       await client.getAddress(),
// //       MILESTONE_AMOUNTS,
// //       CLAIM_PERIOD,
// //       MAX_VOTING_PERIOD
// //     );

// //     // Mint and approve tokens for investors
// //     await mockUSDC.connect(investor1).mint(TARGET_AMOUNT);
// //     await mockUSDC.connect(investor2).mint(TARGET_AMOUNT);
// //     await mockUSDC.connect(investor1).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT);
// //     await mockUSDC.connect(investor2).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT);

// //     // Mint security tokens and approve for pledging
// //     await securityToken.connect(client).transfer(crowdFundingContract.getAddress(), TARGET_AMOUNT);
// //     await securityToken.connect(client).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT);
// //   });

// //   describe('Initialization', function () {
// //     it('should initialize contract with correct parameters', async function () {
// //       expect(await crowdFundingContract.securityToken()).to.equal(await securityToken.getAddress());
// //       expect(await crowdFundingContract.mockUSDC()).to.equal(await mockUSDC.getAddress());
// //       expect(await crowdFundingContract.auditor()).to.equal(await auditor.getAddress());
// //       expect(await crowdFundingContract.generalContractor()).to.equal(await generalContractor.getAddress());
// //       expect(await crowdFundingContract.client()).to.equal(await client.getAddress());
// //     });
// //   });

// //   describe('Token Pledging', function () {
// //     it('should allow client to pledge security tokens', async function () {
// //       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);

// //       expect(await crowdFundingContract.tokensPledged()).to.be.true;
// //     });

// //     it('should fail if non-client tries to pledge tokens', async function () {
// //       await expect(
// //         crowdFundingContract.connect(investor1).pledgeTokens(TARGET_AMOUNT)
// //       ).to.be.revertedWith('Only the client can pledge tokens');
// //     });
// //   });

// //   describe('Investment Flow', function () {
// //     beforeEach(async function () {
// //       // Pledge tokens before investing
// //       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
// //     });

// //     it('should allow investments within funding period', async function () {
// //       // Invest half the target amount
// //       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT / 2n);

// //       expect(await crowdFundingContract.fundsRaised()).to.equal(TARGET_AMOUNT / 2n);
// //       expect(await crowdFundingContract.investorBalances(investor1.address)).to.equal(TARGET_AMOUNT / 2n);
// //     });

// //     it('should complete funding and release energy tokens when target is reached', async function () {
// //       // Invest full target amount
// //       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT / 2n);
// //       await crowdFundingContract.connect(investor2).invest(TARGET_AMOUNT / 2n);

// //       // Check funding status
// //       const fundingStatus = await crowdFundingContract.fundingStatus();
// //       expect(fundingStatus).to.equal(1); // Successful

// //       // Claim energy tokens
// //       await crowdFundingContract.connect(investor1).claimEnergyTokens();
// //       await crowdFundingContract.connect(investor2).claimEnergyTokens();
// //     });

// //     it('should allow refunds if funding fails', async function () {
// //       // Invest, but don't reach target
// //       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT / 4n);

// //       // Simulate time passing beyond investment period
// //       await ethers.provider.send('evm_increaseTime', [86400 * 31]); // 31 days
// //       await ethers.provider.send('evm_mine');

// //       // Update funding status
// //       await crowdFundingContract.updateFundingStatus();

// //       // Claim refund
// //       await crowdFundingContract.connect(investor1).claimRefund();

// //       // Check refund balance
// //       const refundBalance = await mockUSDC.balanceOf(investor1.address);
// //       expect(refundBalance).to.equal(TARGET_AMOUNT / 4n);
// //     });
// //   });

// //   describe('Milestone Management', function () {
// //     beforeEach(async function () {
// //       // Complete full funding process
// //       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
// //       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT / 2n);
// //       await crowdFundingContract.connect(investor2).invest(TARGET_AMOUNT / 2n);

// //       // Sign agreement
// //       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));
// //       const signature = await generalContractor.signMessage(
// //         ethers.getBytes(agreementHash)
// //       );
// //       await crowdFundingContract.connect(generalContractor).signAgreement(agreementHash, signature);
// //     });

// //     it('should allow auditor to verify milestones', async function () {
// //       // Verify first milestone
// //       await crowdFundingContract.connect(auditor).verifyMilestone(0);

// //       const milestoneDetails = await crowdFundingContract.getMilestoneDetails(0);
// //       expect(milestoneDetails.verified).to.be.true;
// //     });

// //     it('should allow general contractor to withdraw funds for verified milestone', async function () {
// //       // Verify first milestone
// //       await crowdFundingContract.connect(auditor).verifyMilestone(0);

// //       // Withdraw funds
// //       await crowdFundingContract.connect(generalContractor).withdrawByGC(0);

// //       const milestoneDetails = await crowdFundingContract.getMilestoneDetails(0);
// //       expect(milestoneDetails.fundsReleased).to.be.true;
// //     });
// //   });

// //   describe('Extra Fund Requests', function () {
// //     beforeEach(async function () {
// //       // Complete full funding process
// //       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
// //       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT / 2n);
// //       await crowdFundingContract.connect(investor2).invest(TARGET_AMOUNT / 2n);

// //       // Sign agreement
// //       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));
// //       const signature = await generalContractor.signMessage(
// //         ethers.getBytes(agreementHash)
// //       );
// //       await crowdFundingContract.connect(generalContractor).signAgreement(agreementHash, signature);
// //     });

// //     it('should allow general contractor to request extra funds', async function () {
// //       const proposalHash = ethers.keccak256(ethers.toUtf8Bytes('Extra Funds Proposal'));
// //       const extraFundAmount = ethers.parseUnits('1000', 6);

// //       await crowdFundingContract.connect(generalContractor).requestExtraFunds(
// //         proposalHash,
// //         extraFundAmount,
// //         'Additional materials needed'
// //       );

// //       const requestCount = await crowdFundingContract.getExtraFundRequestCount();
// //       expect(requestCount).to.equal(1);
// //     });

// //     it('should allow auditor to approve and investors to vote on extra fund request', async function () {
// //       const proposalHash = ethers.keccak256(ethers.toUtf8Bytes('Extra Funds Proposal'));
// //       const extraFundAmount = ethers.parseUnits('1000', 6);

// //       // Request extra funds
// //       await crowdFundingContract.connect(generalContractor).requestExtraFunds(
// //         proposalHash,
// //         extraFundAmount,
// //         'Additional materials needed'
// //       );

// //       // Auditor approves request
// //       await crowdFundingContract.connect(auditor).approveExtraFundRequest(0, MAX_VOTING_PERIOD);

// //       // Investors vote
// //       await crowdFundingContract.connect(investor1).voteOnExtraFundRequest(0, true);
// //       await crowdFundingContract.connect(investor2).voteOnExtraFundRequest(0, true);

// //       // Execute request
// //       await ethers.provider.send('evm_increaseTime', [MAX_VOTING_PERIOD + 1]);
// //       await ethers.provider.send('evm_mine');

// //       await crowdFundingContract.connect(auditor).executeExtraFundRequest(0);

// //       const requestDetails = await crowdFundingContract.getExtraFundRequestDetails(0);
// //       expect(requestDetails.executed).to.be.true;
// //     });
// //   });

// //   describe('Energy Credits', function () {
// //     beforeEach(async function () {
// //       // Complete full funding process
// //       await crowdFundingContract.connect(client).pledgeTokens(TARGET_AMOUNT);
// //       await crowdFundingContract.connect(investor1).invest(TARGET_AMOUNT / 2n);
// //       await crowdFundingContract.connect(investor2).invest(TARGET_AMOUNT / 2n);

// //       // Complete all milestones
// //       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));
// //       const signature = await generalContractor.signMessage(
// //         ethers.getBytes(agreementHash)
// //       );
// //       await crowdFundingContract.connect(generalContractor).signAgreement(agreementHash, signature);

// //       for (let i = 0; i < MILESTONE_AMOUNTS.length; i++) {
// //         await crowdFundingContract.connect(auditor).verifyMilestone(i);
// //         await crowdFundingContract.connect(generalContractor).withdrawByGC(i);
// //       }

// //       // Complete final milestone
// //       await crowdFundingContract.connect(auditor).completeFinalMilestone();

// //       // Set energy provider
// //       await crowdFundingContract.connect(owner).setEnergyProvider(energyProvider.address);
// //     });

// //     it('should allow burning energy tokens and claiming credits', async function () {
// //       // Claim energy tokens first
// //       await crowdFundingContract.connect(investor1).claimEnergyTokens();

// //       // Approve energy token spending
// //       await energyToken.connect(investor1).approve(crowdFundingContract.getAddress(), TARGET_AMOUNT / 2n);

// //       // Burn tokens and claim credits
// //       await crowdFundingContract.connect(investor1).burnAndClaimEnergyCredits(TARGET_AMOUNT / 4n);

// //       // Verify by energy provider
// //       await crowdFundingContract.connect(energyProvider).verifyEnergyCreditRedemption(investor1.address);

// //       // Get redemption details
// //       const redemptionDetails = await crowdFundingContract.getEnergyCreditRedemptionDetails(investor1.address);

// //       expect(redemptionDetails.tokensBurned).to.equal(TARGET_AMOUNT / 4n);
// //       expect(redemptionDetails.verifiedByProvider).to.be.true;
// //     });
// //   });
// // });
