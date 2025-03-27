/* eslint-disable */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { CrowdFunding, SecurityToken, EnergyToken, MockUSDC } from "../../typechain-types";
import { ContractTransactionReceipt, parseEther, keccak256, toUtf8Bytes, AbiCoder, concat } from "ethers";

describe("CrowdFunding", function () {
  // Contract instances
  let crowdFunding: CrowdFunding;
  let securityToken: SecurityToken;
  let mockUSDC: MockUSDC;
  let energyToken: EnergyToken;

  // Signers/Addresses
  let owner: HardhatEthersSigner;
  let auditor: HardhatEthersSigner;
  let generalContractor: HardhatEthersSigner;
  let client: HardhatEthersSigner;
  let investor1: HardhatEthersSigner;
  let investor2: HardhatEthersSigner;
  let energyProvider: HardhatEthersSigner;
  let signers: HardhatEthersSigner[];

  // Constants for tests
  const INVESTMENT_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
  const TARGET_AMOUNT = parseEther("1000"); // 1000 tokens
  const MILESTONE_AMOUNTS = [parseEther("300"), parseEther("400"), parseEther("300")];
  const CLAIM_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
  const INVESTMENT_AMOUNT_1 = parseEther("500");
  const INVESTMENT_AMOUNT_2 = parseEther("500");
  const EXTRA_FUND_AMOUNT = parseEther("100");
  const ENERGY_TOKEN_AMOUNT = parseEther("100");
  const AGREEMENT_TERMS = "Agreement terms";
  // Hardhat test private keys (for signing)
  const HARDHAT_PRIVATE_KEYS = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // account #4
  ];

  // ----- HELPER FUNCTIONS -----

  // Get event from transaction receipt
  async function getEventFromTx(txReceipt: ContractTransactionReceipt, eventName: string, contract = crowdFunding) {
    if (!txReceipt || !txReceipt.logs) {
      return null;
    }

    const events = [];
    for (const log of txReceipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsedLog && parsedLog.name === eventName) {
          events.push(parsedLog);
        }
      } catch (e) {
        // Skip logs that can't be parsed
      }
    }

    return events.length > 0 ? events[0] : null;
  }

  // Find signer index in signers array
  function findSignerIndex(signer: HardhatEthersSigner) {
    for (let i = 0; i < signers.length; i++) {
      if (signers[i].address === signer.address) {
        return i;
      }
    }
    throw new Error("Signer not found in signers array");
  }

  // Sign agreement for general contractor
  async function signAgreement(signer = generalContractor) {
    console.log("\nSigning agreement...");
    const agreementHash = keccak256(toUtf8Bytes(AGREEMENT_TERMS));
    const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();

    // Encode message for EIP-712
    const messageHash = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
      ),
    );

    // Create final EIP-712 digest
    const digest = keccak256(concat([toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));

    // Find signer index and use corresponding private key
    const signerIndex = findSignerIndex(signer);
    const privateKey = HARDHAT_PRIVATE_KEYS[signerIndex];

    // Create wallet and sign the digest
    const wallet = new ethers.Wallet(privateKey);
    const signature = wallet.signingKey.sign(digest);

    // Format signature correctly
    const flatSig = concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);

    // Submit signed agreement
    await crowdFunding.connect(signer).signAgreement(agreementHash, flatSig);
    console.log(`Agreement signed by ${await signer.getAddress()}`);

    return { agreementHash, flatSig };
  }

  // Pledge tokens by client
  async function pledgeTokens() {
    console.log("\nClient pledging tokens...");
    const tx = await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
    await tx.wait();
    console.log("Tokens pledged successfully");
  }

  // Complete funding process
  async function completeFunding() {
    console.log("\nInvestors completing funding...");
    await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
    await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
    console.log("Funding completed successfully");
  }

  // Verify a specific milestone
  async function verifyMilestone(milestoneIndex: number) {
    console.log(`\nVerifying milestone ${milestoneIndex}...`);
    const tx = await crowdFunding.connect(auditor).verifyMilestone(milestoneIndex);
    const receipt = await tx.wait();
    console.log(`Milestone ${milestoneIndex} verified`);
    return receipt;
  }

  // Verify all milestones
  async function verifyAllMilestones() {
    console.log("\nVerifying all milestones...");
    for (let i = 0; i < MILESTONE_AMOUNTS.length; i++) {
      await verifyMilestone(i);
    }
    console.log("All milestones verified");
  }

  // Create extra fund request
  async function createExtraFundRequest(amount = EXTRA_FUND_AMOUNT, description = "Additional materials needed") {
    console.log("\nCreating extra fund request...");
    const proposalHash = keccak256(toUtf8Bytes("Extra fund proposal"));

    const tx = await crowdFunding.connect(generalContractor).requestExtraFunds(proposalHash, amount, description);

    const receipt = await tx.wait();
    const event = await getEventFromTx(receipt!, "ExtraFundRequestCreated");
    const requestId = Number(event!.args.requestId);

    console.log(`Extra fund request created with ID: ${requestId}`);
    return requestId;
  }

  // ----- SETUP FUNCTIONS -----

  // Basic deployment setup
  async function setupBasicDeployment() {
    console.log("\n----- Setting up test environment -----");

    // Get signers
    signers = await ethers.getSigners();
    [owner, auditor, generalContractor, client, investor1, investor2, energyProvider] = signers;

    // Deploy tokens
    console.log("\nDeploying tokens...");
    const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
    securityToken = await SecurityTokenFactory.deploy("Security Token", "ST");

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy("Mock USDC", "mUSDC");

    const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
    energyToken = await EnergyTokenFactory.deploy("Energy Token", "ET");

    // Get current timestamp and set investment period
    const currentTimestamp = await time.latest();
    const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

    // Deploy CrowdFunding contract
    console.log("\nDeploying CrowdFunding contract...");
    const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
    crowdFunding = await CrowdFundingFactory.deploy(
      await securityToken.getAddress(),
      await mockUSDC.getAddress(),
      await energyToken.getAddress(),
      investmentPeriod,
      TARGET_AMOUNT,
      auditor.address,
      generalContractor.address,
      client.address,
      MILESTONE_AMOUNTS,
      CLAIM_PERIOD,
    );

    // Setup roles and tokens
    await energyToken.grantRole(await energyToken.MINTER_ROLE(), await crowdFunding.getAddress());
    await crowdFunding.setEnergyProvider(energyProvider.address);

    // Mint tokens
    await securityToken.mint(client.address, TARGET_AMOUNT);
    await mockUSDC.mint(investor1.address, INVESTMENT_AMOUNT_1);
    await mockUSDC.mint(investor2.address, INVESTMENT_AMOUNT_2);

    // Approve tokens
    await securityToken.connect(client).approve(await crowdFunding.getAddress(), TARGET_AMOUNT);
    await mockUSDC.connect(investor1).approve(await crowdFunding.getAddress(), INVESTMENT_AMOUNT_1);
    await mockUSDC.connect(investor2).approve(await crowdFunding.getAddress(), INVESTMENT_AMOUNT_2);

    console.log("----- Basic test setup complete -----");

    return { currentTimestamp, investmentPeriod };
  }

  // Setup with tokens pledged
  async function setupWithTokensPledged() {
    await setupBasicDeployment();
    await pledgeTokens();
  }

  // Setup with funding completed
  async function setupWithFundingCompleted() {
    await setupWithTokensPledged();
    await completeFunding();
  }

  // Setup with agreement signed
  async function setupWithAgreementSigned() {
    await setupWithFundingCompleted();
    await signAgreement();
  }

  // Setup with all milestones verified
  async function setupWithMilestonesVerified() {
    await setupWithAgreementSigned();
    await verifyAllMilestones();
  }

  // Main beforeEach for all tests
  beforeEach(async function () {
    await setupBasicDeployment();
  });

  // ----- TEST SUITES -----

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await crowdFunding.auditor()).to.equal(auditor.address);
      expect(await crowdFunding.generalContractor()).to.equal(generalContractor.address);
      expect(await crowdFunding.client()).to.equal(client.address);
      expect(await crowdFunding.securityToken()).to.equal(await securityToken.getAddress());
      expect(await crowdFunding.mockUSDC()).to.equal(await mockUSDC.getAddress());
      expect(await crowdFunding.energyToken()).to.equal(await energyToken.getAddress());
      expect(await crowdFunding.CLAIM_PERIOD()).to.equal(CLAIM_PERIOD);

      // Check proposal details
      const proposal = await crowdFunding.proposal();
      expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);

      // Check milestones
      const milestoneCount = await crowdFunding.getMilestoneCount();
      expect(milestoneCount).to.equal(MILESTONE_AMOUNTS.length);

      for (let i = 0; i < milestoneCount; i++) {
        const milestone = await crowdFunding.getMilestoneDetails(i);
        expect(milestone[0]).to.equal(MILESTONE_AMOUNTS[i]);
        expect(milestone[1]).to.be.false; // verified should be false
        expect(milestone[2]).to.be.false; // fundsReleased should be false
      }

      // Check funding status
      expect(await crowdFunding.fundingStatus()).to.equal(0); // Active
    });

    it("Should revert if invalid parameters are provided", async function () {
      const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
      const currentTimestamp = await time.latest();
      const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

      // Zero address for security token
      await expect(
        CrowdFundingFactory.deploy(
          ethers.ZeroAddress,
          await mockUSDC.getAddress(),
          await energyToken.getAddress(),
          investmentPeriod,
          TARGET_AMOUNT,
          auditor.address,
          generalContractor.address,
          client.address,
          MILESTONE_AMOUNTS,
          CLAIM_PERIOD,
        ),
      ).to.be.revertedWith("Security token cannot be zero address");

      // Past investment period
      await expect(
        CrowdFundingFactory.deploy(
          await securityToken.getAddress(),
          await mockUSDC.getAddress(),
          await energyToken.getAddress(),
          currentTimestamp, // past or present time
          TARGET_AMOUNT,
          auditor.address,
          generalContractor.address,
          client.address,
          MILESTONE_AMOUNTS,
          CLAIM_PERIOD,
        ),
      ).to.be.revertedWith("Investment period must be in the future");

      // Zero target amount
      await expect(
        CrowdFundingFactory.deploy(
          await securityToken.getAddress(),
          await mockUSDC.getAddress(),
          await energyToken.getAddress(),
          investmentPeriod,
          0, // zero target amount
          auditor.address,
          generalContractor.address,
          client.address,
          MILESTONE_AMOUNTS,
          CLAIM_PERIOD,
        ),
      ).to.be.revertedWith("Target amount must be greater than zero");

      // Empty milestone array
      await expect(
        CrowdFundingFactory.deploy(
          await securityToken.getAddress(),
          await mockUSDC.getAddress(),
          await energyToken.getAddress(),
          investmentPeriod,
          TARGET_AMOUNT,
          auditor.address,
          generalContractor.address,
          client.address,
          [], // empty milestone array
          CLAIM_PERIOD,
        ),
      ).to.be.revertedWith("Must have at least one milestone");
    });
  });

  describe("Token Pledging", function () {
    it("Should allow client to pledge tokens", async function () {
      const contractBalanceBefore = await securityToken.balanceOf(await crowdFunding.getAddress());

      const tx = await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "TokensPledged");
      expect(event).to.not.be.null;
      expect(event!.args.pledger).to.equal(client.address);
      expect(event!.args.amount).to.equal(TARGET_AMOUNT);

      // Check state updates
      expect(await crowdFunding.tokensPledged()).to.be.true;
      expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(TARGET_AMOUNT);
      expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(TARGET_AMOUNT);
    });

    it("Should revert if non-client tries to pledge tokens", async function () {
      await expect(crowdFunding.connect(investor1).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith(
        "Only client can call this function",
      );
    });

    it("Should revert if pledge amount is zero", async function () {
      await expect(crowdFunding.connect(client).pledgeTokens(0)).to.be.revertedWith(
        "Pledge amount must be greater than zero",
      );
    });

    it("Should revert if allowance is too low", async function () {
      // Reset the approval to a low amount
      await securityToken.connect(client).approve(await crowdFunding.getAddress(), parseEther("1"));

      await expect(crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith("Allowance too low");
    });
  });

  describe("Investment Process", function () {
    beforeEach(async function () {
      await pledgeTokens();
    });

    it("Should allow investors to invest", async function () {
      const investorBalanceBefore = await mockUSDC.balanceOf(investor1.address);
      const contractBalanceBefore = await mockUSDC.balanceOf(await crowdFunding.getAddress());

      const tx = await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "InvestmentReceived");
      expect(event).to.not.be.null;
      expect(event!.args.investor).to.equal(investor1.address);
      expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

      // Check state updates
      expect(await crowdFunding.fundsRaised()).to.equal(INVESTMENT_AMOUNT_1);
      expect(await crowdFunding.investorBalances(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
      expect(await crowdFunding.pendingEnergyTokens(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
      expect(await mockUSDC.balanceOf(await crowdFunding.getAddress())).to.equal(INVESTMENT_AMOUNT_1);
    });

    it("Should mark funding as successful when target amount is reached", async function () {
      // First investor invests
      await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

      // Second investor invests, reaching target
      const tx = await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
      const receipt = await tx.wait();

      // Check for FundingSuccessful event
      const fundingEvent = await getEventFromTx(receipt!, "FundingSuccessful");
      expect(fundingEvent).to.not.be.null;

      // Check for EnergyTokensReleased event
      const energyEvent = await getEventFromTx(receipt!, "EnergyTokensReleased");
      expect(energyEvent).to.not.be.null;

      // Check state updates
      expect(await crowdFunding.fundingStatus()).to.equal(1); // Successful
      expect(await crowdFunding.fundsRaised()).to.equal(TARGET_AMOUNT);
      expect(await crowdFunding.energyTokensReleased()).to.be.true;
    });

    it("Should mark funding as failed when investment period ends without reaching target", async function () {
      // Invest less than the target amount
      await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

      // Fast forward past the investment period
      const proposal = await crowdFunding.proposal();
      await time.increaseTo(Number(proposal.investmentPeriod) + 1);

      // Update funding status manually
      const tx = await crowdFunding.updateFundingStatus();
      const receipt = await tx.wait();

      // Check for FundingFailed event
      const event = await getEventFromTx(receipt!, "FundingFailed");
      expect(event).to.not.be.null;

      // Check state update
      expect(await crowdFunding.fundingStatus()).to.equal(2); // Failed
    });

    it("Should revert investment when various conditions aren't met", async function () {
      // Take a snapshot before modifying time
      const snapshotId = await ethers.provider.send("evm_snapshot", []);

      // Deploy a new contract to test tokens not pledged scenario
      const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
      const currentTimestamp = await time.latest();
      const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

      const newContract = await CrowdFundingFactory.deploy(
        await securityToken.getAddress(),
        await mockUSDC.getAddress(),
        await energyToken.getAddress(),
        investmentPeriod,
        TARGET_AMOUNT,
        auditor.address,
        generalContractor.address,
        client.address,
        MILESTONE_AMOUNTS,
        CLAIM_PERIOD,
      );

      // Tokens not pledged
      await expect(newContract.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
        "INVEST: Security tokens not pledged",
      );

      // Zero amount
      await expect(crowdFunding.connect(investor1).invest(0)).to.be.revertedWith(
        "INVEST: Amount must be greater than zero",
      );

      // After investment period
      const proposal = await crowdFunding.proposal();
      await time.increaseTo(Number(proposal.investmentPeriod) + 1);

      await expect(crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
        "INVEST: Investment period has ended",
      );

      // Instead of setting time back, revert to the previous snapshot
      await ethers.provider.send("evm_revert", [snapshotId]);

      // Exceed target amount
      await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
      const exceedAmount = TARGET_AMOUNT - INVESTMENT_AMOUNT_1 + parseEther("1");

      // Mint more tokens to investor2 for this test
      await mockUSDC.mint(investor2.address, exceedAmount);
      await mockUSDC.connect(investor2).approve(await crowdFunding.getAddress(), exceedAmount);

      await expect(crowdFunding.connect(investor2).invest(exceedAmount)).to.be.revertedWith(
        "INVEST: Funding target exceeded",
      );
    });
  });

  describe("Claiming Energy Tokens", function () {
    beforeEach(async function () {
      await setupWithFundingCompleted();
    });

    it("Should allow investors to claim energy tokens", async function () {
      const investorEnergyBalance = await energyToken.balanceOf(investor1.address);
      const pendingTokens = await crowdFunding.pendingEnergyTokens(investor1.address);

      const tx = await crowdFunding.connect(investor1).claimEnergyTokens();
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "EnergyTokensClaimed");
      expect(event).to.not.be.null;
      expect(event!.args.investor).to.equal(investor1.address);
      expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

      // Check state updates
      expect(await energyToken.balanceOf(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
      expect(await crowdFunding.pendingEnergyTokens(investor1.address)).to.equal(0);
    });

    it("Should revert if investor tries to claim twice", async function () {
      // Claim once
      await crowdFunding.connect(investor1).claimEnergyTokens();

      // Try to claim again
      await expect(crowdFunding.connect(investor1).claimEnergyTokens()).to.be.revertedWith("No energy tokens to claim");
    });

    it("Should revert if funding isn't successful", async function () {
      // Deploy new contract
      const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
      const currentTimestamp = await time.latest();
      const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

      const newContract = await CrowdFundingFactory.deploy(
        await securityToken.getAddress(),
        await mockUSDC.getAddress(),
        await energyToken.getAddress(),
        investmentPeriod,
        TARGET_AMOUNT,
        auditor.address,
        generalContractor.address,
        client.address,
        MILESTONE_AMOUNTS,
        CLAIM_PERIOD,
      );

      await expect(newContract.connect(investor1).claimEnergyTokens()).to.be.revertedWith(
        "Funding must be successful to claim tokens",
      );
    });
  });

  describe("Agreement and Milestone Management", function () {
    beforeEach(async function () {
      await setupWithFundingCompleted();
    });

    it("Should allow general contractor to sign agreement", async function () {
      const { agreementHash, flatSig } = await signAgreement();

      // Verify agreement is signed
      expect(await crowdFunding.gcAgreement()).to.equal(true);
    });

    it("Should allow auditor to verify milestone", async function () {
      // Sign agreement first
      await signAgreement();

      // Check milestone details before verification
      const milestoneIndex = 0;
      const milestoneBefore = await crowdFunding.getMilestoneDetails(milestoneIndex);
      expect(milestoneBefore[1]).to.be.false; // verified should be false

      // Verify milestone
      const receipt = await verifyMilestone(milestoneIndex);

      // Check event
      const event = await getEventFromTx(receipt!, "MilestoneVerified");
      expect(event).to.not.be.null;
      expect(event!.args.milestoneIndex).to.equal(milestoneIndex);

      // Check state update
      const milestoneAfter = await crowdFunding.getMilestoneDetails(milestoneIndex);
      expect(milestoneAfter[1]).to.be.true; // verified should be true
    });

    it("Should allow general contractor to withdraw funds for verified milestone", async function () {
      // Sign agreement
      await signAgreement();

      // Verify milestone
      const milestoneIndex = 0;
      await verifyMilestone(milestoneIndex);

      // Get GC's balance before withdrawal
      const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

      // Withdraw funds
      const tx = await crowdFunding.connect(generalContractor).withdrawByGC(milestoneIndex);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "FundsWithdrawn");
      expect(event).to.not.be.null;
      expect(event!.args.milestoneIndex).to.equal(milestoneIndex);
      expect(event!.args.amount).to.equal(MILESTONE_AMOUNTS[milestoneIndex]);

      // Check state update
      const milestone = await crowdFunding.getMilestoneDetails(milestoneIndex);
      expect(milestone[2]).to.be.true; // fundsReleased should be true

      // Check GC's balance increased
      const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
      expect(gcBalanceAfter - gcBalanceBefore).to.equal(MILESTONE_AMOUNTS[milestoneIndex]);
    });

    it("Should emit FinalMilestoneAchieved when last milestone is verified", async function () {
      // Sign agreement
      await signAgreement();

      // Verify all milestones except the last one
      for (let i = 0; i < MILESTONE_AMOUNTS.length - 1; i++) {
        await verifyMilestone(i);
      }

      // Verify the last milestone
      const lastMilestoneIndex = MILESTONE_AMOUNTS.length - 1;
      const receipt = await verifyMilestone(lastMilestoneIndex);

      // Check event
      const event = await getEventFromTx(receipt!, "FinalMilestoneAchieved");
      expect(event).to.not.be.null;

      // Check state updates
      expect(await crowdFunding.finalMilestoneAchieved()).to.be.true;

      // Check creditClaimDeadline is set
      const currentTime = await time.latest();
      const claimDeadline = await crowdFunding.creditClaimDeadline();
      expect(claimDeadline).to.closeTo(currentTime + CLAIM_PERIOD, 10); // Allow small time variance
    });
  });

  describe("Extra Fund Requests", function () {
    let requestId: number;

    beforeEach(async function () {
      // Setup with agreement signed
      await setupWithAgreementSigned();

      // Create extra fund request
      requestId = await createExtraFundRequest();
    });

    it("Should allow auditor to approve extra fund request for voting", async function () {
      const votingDuration = 3 * 24 * 60 * 60; // 3 days

      const tx = await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "ExtraFundRequestApproved");
      expect(event).to.not.be.null;
      expect(event!.args.requestId).to.equal(requestId);
      expect(event!.args.votingDuration).to.equal(votingDuration);

      // Check state update
      const request = await crowdFunding.getExtraFundRequestDetails(requestId);
      expect(request[3]).to.be.true; // auditorApproved should be true

      const currentTime = await time.latest();
      expect(request[4]).to.closeTo(currentTime + votingDuration, 10); // votingEndTime
    });

    it("Should allow investors to vote on approved extra fund requests", async function () {
      // Approve request
      const votingDuration = 3 * 24 * 60 * 60; // 3 days
      await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

      // Investor1 votes in favor
      const tx1 = await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, true);
      const receipt1 = await tx1.wait();

      // Check event
      const event1 = await getEventFromTx(receipt1!, "ExtraFundVoteCast");
      expect(event1).to.not.be.null;
      expect(event1!.args.requestId).to.equal(requestId);
      expect(event1!.args.voter).to.equal(investor1.address);
      expect(event1!.args.support).to.be.true;
      expect(event1!.args.stake).to.equal(INVESTMENT_AMOUNT_1);

      // Investor2 votes against
      const tx2 = await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, false);
      const receipt2 = await tx2.wait();

      // Check event
      const event2 = await getEventFromTx(receipt2!, "ExtraFundVoteCast");
      expect(event2).to.not.be.null;
      expect(event2!.args.requestId).to.equal(requestId);
      expect(event2!.args.voter).to.equal(investor2.address);
      expect(event2!.args.support).to.be.false;
      expect(event2!.args.stake).to.equal(INVESTMENT_AMOUNT_2);

      // Check state update
      const request = await crowdFunding.getExtraFundRequestDetails(requestId);
      expect(request[5]).to.equal(INVESTMENT_AMOUNT_1); // votesFor
      expect(request[6]).to.equal(INVESTMENT_AMOUNT_2); // votesAgainst
    });

    it("Should execute approved extra fund request after voting period", async function () {
      // Approve request
      const votingDuration = 3 * 24 * 60 * 60; // 3 days
      await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

      // Investors vote (both in favor for this test)
      await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, true);
      await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, true);

      // Fast forward past voting period
      const request = await crowdFunding.getExtraFundRequestDetails(requestId);
      await time.increaseTo(Number(request[4]) + 1);

      // Execute request
      const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

      const tx = await crowdFunding.connect(auditor).executeExtraFundRequest(requestId);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "ExtraFundRequestExecuted");
      expect(event).to.not.be.null;
      expect(event!.args.requestId).to.equal(requestId);
      expect(event!.args.approved).to.be.true;

      // Check state update
      const updatedRequest = await crowdFunding.getExtraFundRequestDetails(requestId);
      expect(updatedRequest[7]).to.be.true; // executed should be true

      // Check GC's balance increased
      const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
      expect(gcBalanceAfter - gcBalanceBefore).to.equal(EXTRA_FUND_AMOUNT);
    });

    it("Should reject extra fund request if majority votes against", async function () {
      // Approve request
      const votingDuration = 3 * 24 * 60 * 60; // 3 days
      await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

      // Investors vote (both against for this test)
      await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, false);
      await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, false);

      // Fast forward past voting period
      const request = await crowdFunding.getExtraFundRequestDetails(requestId);
      await time.increaseTo(Number(request[4]) + 1);

      // Execute request
      const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

      const tx = await crowdFunding.connect(auditor).executeExtraFundRequest(requestId);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "ExtraFundRequestRejected");
      expect(event).to.not.be.null;
      expect(event!.args.requestId).to.equal(requestId);

      // Check state update
      const updatedRequest = await crowdFunding.getExtraFundRequestDetails(requestId);
      expect(updatedRequest[7]).to.be.true; // executed should be true

      // Check GC's balance didn't change
      const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
      expect(gcBalanceAfter).to.equal(gcBalanceBefore);
    });
  });

  describe("Energy Credits", function () {
    beforeEach(async function () {
      // Setup with all milestones verified
      await setupWithMilestonesVerified();

      // Claim energy tokens
      await crowdFunding.connect(investor1).claimEnergyTokens();

      // Approve energy token spending
      await energyToken.connect(investor1).approve(await crowdFunding.getAddress(), ENERGY_TOKEN_AMOUNT);
    });

    it("Should allow investors to burn energy tokens for credits", async function () {
      const tx = await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);
      const receipt = await tx.wait();

      // Check events
      const burnEvent = await getEventFromTx(receipt!, "EnergyTokensBurned");
      expect(burnEvent).to.not.be.null;
      expect(burnEvent!.args.investor).to.equal(investor1.address);
      expect(burnEvent!.args.amount).to.equal(ENERGY_TOKEN_AMOUNT);

      const claimEvent = await getEventFromTx(receipt!, "EnergyCreditsClaimed");
      expect(claimEvent).to.not.be.null;
      expect(claimEvent!.args.investor).to.equal(investor1.address);

      // Default rate is 1:1
      const defaultRate = await crowdFunding.energyCreditRate();
      expect(claimEvent!.args.credits).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate);

      // Check state update
      expect(await crowdFunding.totalTokensBurned()).to.equal(ENERGY_TOKEN_AMOUNT);

      const redemptionDetails = await crowdFunding
        .connect(investor1)
        .getEnergyCreditRedemptionDetails(investor1.address);
      expect(redemptionDetails[0]).to.equal(ENERGY_TOKEN_AMOUNT); // tokensBurned
      expect(redemptionDetails[1]).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate); // creditsEarned
      expect(redemptionDetails[2]).to.be.false; // redeemed
      expect(redemptionDetails[3]).to.be.false; // verified
    });

    it("Should allow energy provider to verify energy credit redemption", async function () {
      // Burn tokens first
      await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);

      // Verify redemption
      const tx = await crowdFunding.connect(energyProvider).verifyEnergyCreditRedemption(investor1.address);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "EnergyCreditsVerified");
      expect(event).to.not.be.null;
      expect(event!.args.investor).to.equal(investor1.address);

      // Check state update
      const redemptionDetails = await crowdFunding
        .connect(investor1)
        .getEnergyCreditRedemptionDetails(investor1.address);
      expect(redemptionDetails[3]).to.be.true; // verified should be true
    });

    it("Should allow owner to update energy credit rate", async function () {
      const newRate = 2; // 1:2 conversion rate

      const tx = await crowdFunding.setEnergyCreditRate(newRate);
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "EnergyCreditRateUpdated");
      expect(event).to.not.be.null;
      expect(event!.args.newRate).to.equal(newRate);

      // Check state update
      expect(await crowdFunding.energyCreditRate()).to.equal(newRate);

      // Test that the new rate is used
      await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);

      const redemptionDetails = await crowdFunding
        .connect(investor1)
        .getEnergyCreditRedemptionDetails(investor1.address);
      expect(redemptionDetails[1]).to.equal(ENERGY_TOKEN_AMOUNT * BigInt(newRate)); // creditsEarned with new rate
    });
  });

  describe("Emergency Stop", function () {
    beforeEach(async function () {
      await pledgeTokens();
    });

    it("Should allow owner to toggle emergency stop", async function () {
      const tx = await crowdFunding.toggleEmergencyStop();
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "EmergencyToggled");
      expect(event).to.not.be.null;
      expect(event!.args.stopped).to.be.true;

      // Check state update
      expect(await crowdFunding.emergencyStop()).to.be.true;

      // Toggle back
      const tx2 = await crowdFunding.toggleEmergencyStop();
      const receipt2 = await tx2.wait();

      // Check event
      const event2 = await getEventFromTx(receipt2!, "EmergencyToggled");
      expect(event2).to.not.be.null;
      expect(event2!.args.stopped).to.be.false;

      // Check state update
      expect(await crowdFunding.emergencyStop()).to.be.false;
    });

    it("Should prevent investing when emergency stop is active", async function () {
      // Enable emergency stop
      await crowdFunding.toggleEmergencyStop();

      // Try to invest
      await expect(crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
        "Contract is in emergency stop",
      );
    });
  });

  describe("Refund Claims", function () {
    beforeEach(async function () {
      // Pledge tokens
      await pledgeTokens();

      // Partial funding
      await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

      // Fast forward past the investment period to make funding fail
      const proposal = await crowdFunding.proposal();
      await time.increaseTo(Number(proposal.investmentPeriod) + 1);

      // Update funding status
      await crowdFunding.updateFundingStatus();
    });

    it("Should allow investors to claim refunds when funding fails", async function () {
      const investorBalanceBefore = await mockUSDC.balanceOf(investor1.address);

      const tx = await crowdFunding.connect(investor1).claimRefund();
      const receipt = await tx.wait();

      // Check event
      const event = await getEventFromTx(receipt!, "RefundClaimed");
      expect(event).to.not.be.null;
      expect(event!.args.investor).to.equal(investor1.address);
      expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

      // Check state update
      expect(await crowdFunding.hasWithdrawnRefund(investor1.address)).to.be.true;

      // Check investor's balance increased
      const investorBalanceAfter = await mockUSDC.balanceOf(investor1.address);
      expect(investorBalanceAfter - investorBalanceBefore).to.equal(INVESTMENT_AMOUNT_1);
    });

    it("Should revert if investor tries to claim refund twice", async function () {
      // Claim once
      await crowdFunding.connect(investor1).claimRefund();

      // Try to claim again
      await expect(crowdFunding.connect(investor1).claimRefund()).to.be.revertedWith("Refund already claimed");
    });

    it("Should revert if funding hasn't failed", async function () {
      // Deploy new contract with successful funding
      const { currentTimestamp, investmentPeriod } = await setupBasicDeployment();

      const newContract = await (
        await ethers.getContractFactory("CrowdFunding")
      ).deploy(
        await securityToken.getAddress(),
        await mockUSDC.getAddress(),
        await energyToken.getAddress(),
        investmentPeriod,
        TARGET_AMOUNT,
        auditor.address,
        generalContractor.address,
        client.address,
        MILESTONE_AMOUNTS,
        CLAIM_PERIOD,
      );

      // Grant the MINTER_ROLE to the new contract
      await energyToken.grantRole(await energyToken.MINTER_ROLE(), await newContract.getAddress());

      // Set up tokens for successful funding
      await securityToken.mint(client.address, TARGET_AMOUNT);
      await securityToken.connect(client).approve(await newContract.getAddress(), TARGET_AMOUNT);
      await newContract.connect(client).pledgeTokens(TARGET_AMOUNT);

      // Successful funding
      await mockUSDC.mint(investor1.address, TARGET_AMOUNT);
      await mockUSDC.connect(investor1).approve(await newContract.getAddress(), TARGET_AMOUNT);
      await newContract.connect(investor1).invest(TARGET_AMOUNT);

      // Try to claim refund
      await expect(newContract.connect(investor1).claimRefund()).to.be.revertedWith("Funding has not failed");
    });
  });
});
/* eslint-enable */

// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { time } from "@nomicfoundation/hardhat-network-helpers";
// import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
// import { CrowdFunding, SecurityToken, EnergyToken, MockUSDC } from "../../typechain-types";
// import { ContractTransactionReceipt, parseEther, keccak256, toUtf8Bytes, AbiCoder, concat } from "ethers";
// //import { setNextBlockTimestamp } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";

// describe("CrowdFunding", function () {
//   // Contract instances
//   let crowdFunding: CrowdFunding;
//   let securityToken: SecurityToken;
//   let mockUSDC: MockUSDC;
//   let energyToken: EnergyToken;

//   // Signers/Addresses
//   let owner: HardhatEthersSigner;
//   let auditor: HardhatEthersSigner;
//   let generalContractor: HardhatEthersSigner;
//   let client: HardhatEthersSigner;
//   let investor1: HardhatEthersSigner;
//   let investor2: HardhatEthersSigner;
//   let energyProvider: HardhatEthersSigner;
//   let signers: HardhatEthersSigner[];

//   // Constants for tests
//   const INVESTMENT_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
//   const TARGET_AMOUNT = parseEther("1000"); // 1000 tokens
//   const MILESTONE_AMOUNTS = [parseEther("300"), parseEther("400"), parseEther("300")];
//   const CLAIM_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
//   //const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
//   const INVESTMENT_AMOUNT_1 = parseEther("500");
//   const INVESTMENT_AMOUNT_2 = parseEther("500");

//   // Helper function to get event from transaction receipt
//   async function getEventFromTx(txReceipt: ContractTransactionReceipt, eventName: string) {
//     if (!txReceipt || !txReceipt.logs) {
//       return null;
//     }

//     const events = [];
//     for (const log of txReceipt.logs) {
//       try {
//         const parsedLog = crowdFunding.interface.parseLog({
//           topics: [...log.topics],
//           data: log.data,
//         });
//         if (parsedLog && parsedLog.name === eventName) {
//           events.push(parsedLog);
//         }
//       } catch (e) {
//         // Skip logs that can't be parsed
//       }
//     }

//     return events.length > 0 ? events[0] : null;
//   }

//   beforeEach(async function () {
//     console.log("\n----- Setting up test environment -----");
//     // Get signers
//     signers = await ethers.getSigners();
//     [owner, auditor, generalContractor, client, investor1, investor2, energyProvider] = signers;
//     console.log(`Owner: ${owner.address}`);
//     console.log(`Auditor: ${auditor.address}`);
//     console.log(`General Contractor: ${generalContractor.address}`);
//     console.log(`Client: ${client.address}`);
//     console.log(`Investor1: ${investor1.address}`);
//     console.log(`Investor2: ${investor2.address}`);
//     console.log(`Energy Provider: ${energyProvider.address}`);

//     // Deploy mock tokens
//     console.log("\nDeploying tokens...");
//     const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
//     securityToken = await SecurityTokenFactory.deploy("Security Token", "ST");
//     console.log(`Security Token deployed to: ${await securityToken.getAddress()}`);

//     const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
//     mockUSDC = await MockUSDCFactory.deploy("Mock USDC", "mUSDC");
//     console.log(`MockUSDC deployed to: ${await mockUSDC.getAddress()}`);

//     const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
//     energyToken = await EnergyTokenFactory.deploy("Energy Token", "ET");
//     console.log(`Energy Token deployed to: ${await energyToken.getAddress()}`);

//     // Get the current timestamp
//     const currentTimestamp = await time.latest();
//     const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;
//     console.log(`Investment period will end at: ${new Date(investmentPeriod * 1000)}`);

//     // Deploy CrowdFunding contract
//     console.log("\nDeploying CrowdFunding contract...");
//     const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//     crowdFunding = await CrowdFundingFactory.deploy(
//       await securityToken.getAddress(),
//       await mockUSDC.getAddress(),
//       await energyToken.getAddress(),
//       investmentPeriod,
//       TARGET_AMOUNT,
//       auditor.address,
//       generalContractor.address,
//       client.address,
//       MILESTONE_AMOUNTS,
//       CLAIM_PERIOD,
//     );
//     console.log(`CrowdFunding deployed to: ${await crowdFunding.getAddress()}`);

//     // Grant minter role to the crowdfunding contract
//     console.log("\nSetting up roles...");
//     await energyToken.grantRole(await energyToken.MINTER_ROLE(), await crowdFunding.getAddress());
//     console.log("Granted MINTER_ROLE to CrowdFunding contract");

//     // Set energy provider in crowdfunding contract
//     await crowdFunding.setEnergyProvider(energyProvider.address);
//     console.log(`Set energy provider to: ${energyProvider.address}`);

//     // Mint tokens to client, investors for testing
//     console.log("\nMinting tokens for testing...");
//     await securityToken.mint(client.address, TARGET_AMOUNT);
//     console.log(`Minted ${ethers.formatEther(TARGET_AMOUNT)} Security Tokens to client`);

//     await mockUSDC.mint(investor1.address, INVESTMENT_AMOUNT_1);
//     console.log(`Minted ${ethers.formatEther(INVESTMENT_AMOUNT_1)} MockUSDC to investor1`);

//     await mockUSDC.mint(investor2.address, INVESTMENT_AMOUNT_2);
//     console.log(`Minted ${ethers.formatEther(INVESTMENT_AMOUNT_2)} MockUSDC to investor2`);

//     // Approve tokens for spending
//     console.log("\nApproving tokens for spending...");
//     await securityToken.connect(client).approve(await crowdFunding.getAddress(), TARGET_AMOUNT);
//     console.log(`Client approved ${ethers.formatEther(TARGET_AMOUNT)} Security Tokens`);

//     await mockUSDC.connect(investor1).approve(await crowdFunding.getAddress(), INVESTMENT_AMOUNT_1);
//     console.log(`Investor1 approved ${ethers.formatEther(INVESTMENT_AMOUNT_1)} MockUSDC`);

//     await mockUSDC.connect(investor2).approve(await crowdFunding.getAddress(), INVESTMENT_AMOUNT_2);
//     console.log(`Investor2 approved ${ethers.formatEther(INVESTMENT_AMOUNT_2)} MockUSDC`);

//     console.log("----- Test setup complete -----\n");
//   });

//   describe("Deployment", function () {
//     it("Should deploy with correct parameters", async function () {
//       expect(await crowdFunding.auditor()).to.equal(auditor.address);
//       expect(await crowdFunding.generalContractor()).to.equal(generalContractor.address);
//       expect(await crowdFunding.client()).to.equal(client.address);
//       expect(await crowdFunding.securityToken()).to.equal(await securityToken.getAddress());
//       expect(await crowdFunding.mockUSDC()).to.equal(await mockUSDC.getAddress());
//       expect(await crowdFunding.energyToken()).to.equal(await energyToken.getAddress());
//       expect(await crowdFunding.CLAIM_PERIOD()).to.equal(CLAIM_PERIOD);

//       // Check proposal details
//       const proposal = await crowdFunding.proposal();
//       expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);

//       // Check milestones
//       const milestoneCount = await crowdFunding.getMilestoneCount();
//       expect(milestoneCount).to.equal(MILESTONE_AMOUNTS.length);

//       for (let i = 0; i < milestoneCount; i++) {
//         const milestone = await crowdFunding.getMilestoneDetails(i);
//         expect(milestone[0]).to.equal(MILESTONE_AMOUNTS[i]);
//         expect(milestone[1]).to.be.false; // verified should be false
//         expect(milestone[2]).to.be.false; // fundsReleased should be false
//       }

//       // Check funding status
//       expect(await crowdFunding.fundingStatus()).to.equal(0); // Active
//     });

//     it("Should revert if invalid parameters are provided", async function () {
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       // Zero address for security token
//       await expect(
//         CrowdFundingFactory.deploy(
//           ethers.ZeroAddress,
//           await mockUSDC.getAddress(),
//           await energyToken.getAddress(),
//           investmentPeriod,
//           TARGET_AMOUNT,
//           auditor.address,
//           generalContractor.address,
//           client.address,
//           MILESTONE_AMOUNTS,
//           CLAIM_PERIOD,
//         ),
//       ).to.be.revertedWith("Security token cannot be zero address");

//       // Past investment period
//       await expect(
//         CrowdFundingFactory.deploy(
//           await securityToken.getAddress(),
//           await mockUSDC.getAddress(),
//           await energyToken.getAddress(),
//           currentTimestamp, // past or present time
//           TARGET_AMOUNT,
//           auditor.address,
//           generalContractor.address,
//           client.address,
//           MILESTONE_AMOUNTS,
//           CLAIM_PERIOD,
//         ),
//       ).to.be.revertedWith("Investment period must be in the future");

//       // Zero target amount
//       await expect(
//         CrowdFundingFactory.deploy(
//           await securityToken.getAddress(),
//           await mockUSDC.getAddress(),
//           await energyToken.getAddress(),
//           investmentPeriod,
//           0, // zero target amount
//           auditor.address,
//           generalContractor.address,
//           client.address,
//           MILESTONE_AMOUNTS,
//           CLAIM_PERIOD,
//         ),
//       ).to.be.revertedWith("Target amount must be greater than zero");

//       // Empty milestone array
//       await expect(
//         CrowdFundingFactory.deploy(
//           await securityToken.getAddress(),
//           await mockUSDC.getAddress(),
//           await energyToken.getAddress(),
//           investmentPeriod,
//           TARGET_AMOUNT,
//           auditor.address,
//           generalContractor.address,
//           client.address,
//           [], // empty milestone array
//           CLAIM_PERIOD,
//         ),
//       ).to.be.revertedWith("Must have at least one milestone");
//     });
//   });

//   describe("Token Pledging", function () {
//     it("Should allow client to pledge tokens", async function () {
//       console.log("\n----- Testing token pledging -----");
//       console.log("Client pledging tokens...");

//       const contractBalanceBefore = await securityToken.balanceOf(await crowdFunding.getAddress());
//       console.log(`Contract security token balance before: ${ethers.formatEther(contractBalanceBefore)}`);

//       const tx = await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//       console.log(`Transaction hash: ${tx.hash}`);

//       const receipt = await tx.wait();
//       console.log("Transaction confirmed");

//       // Check event
//       const event = await getEventFromTx(receipt!, "TokensPledged");
//       console.log("Event details:", {
//         pledger: event ? event.args.pledger : "Event not found",
//         amount: event ? ethers.formatEther(event.args.amount) : "Event not found",
//       });

//       // Check state update
//       const tokensPledged = await crowdFunding.tokensPledged();
//       console.log(`TokensPledged state: ${tokensPledged}`);

//       const contractBalanceAfter = await securityToken.balanceOf(await crowdFunding.getAddress());
//       console.log(`Contract security token balance after: ${ethers.formatEther(contractBalanceAfter)}`);

//       const energyTokenBalance = await energyToken.balanceOf(await crowdFunding.getAddress());
//       console.log(`Contract energy token balance: ${ethers.formatEther(energyTokenBalance)}`);

//       expect(await crowdFunding.tokensPledged()).to.be.true;
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(TARGET_AMOUNT);
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(TARGET_AMOUNT);
//       console.log("----- Test completed -----\n");
//     });

//     it("Should revert if non-client tries to pledge tokens", async function () {
//       console.log("\n----- Testing non-client pledge restriction -----");
//       console.log("Investor1 attempting to pledge tokens (should fail)...");

//       try {
//         await crowdFunding.connect(investor1).pledgeTokens(TARGET_AMOUNT);
//         console.log("ERROR: Transaction did not revert as expected");
//       } catch (error: any) {
//         console.log(`Revert reason: ${error.message}`);
//       }

//       await expect(crowdFunding.connect(investor1).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith(
//         "Only client can call this function",
//       );
//       console.log("----- Test completed -----\n");
//     });

//     it("Should revert if pledge amount is zero", async function () {
//       await expect(crowdFunding.connect(client).pledgeTokens(0)).to.be.revertedWith(
//         "Pledge amount must be greater than zero",
//       );
//     });

//     it("Should revert if allowance is too low", async function () {
//       // Reset the approval to a low amount
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), parseEther("1"));

//       await expect(crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith("Allowance too low");
//     });
//   });

//   describe("Investment Process", function () {
//     beforeEach(async function () {
//       // Pledge tokens first
//       console.log("\n----- Setting up for investment test -----");
//       console.log("Client pledging tokens...");
//       await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//       console.log("Tokens pledged successfully");
//     });

//     it("Should allow investors to invest", async function () {
//       console.log("\n----- Testing investment process -----");

//       const investorBalanceBefore = await mockUSDC.balanceOf(investor1.address);
//       console.log(`Investor1 USDC balance before: ${ethers.formatEther(investorBalanceBefore)}`);

//       const contractBalanceBefore = await mockUSDC.balanceOf(await crowdFunding.getAddress());
//       console.log(`Contract USDC balance before: ${ethers.formatEther(contractBalanceBefore)}`);

//       console.log(`Investor1 investing ${ethers.formatEther(INVESTMENT_AMOUNT_1)} MockUSDC...`);
//       const tx = await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       console.log(`Transaction hash: ${tx.hash}`);

//       const receipt = await tx.wait();
//       console.log("Transaction confirmed");

//       // Check event
//       const event = await getEventFromTx(receipt!, "InvestmentReceived");
//       console.log("Event details:", {
//         investor: event ? event.args.investor : "Event not found",
//         amount: event ? ethers.formatEther(event.args.amount) : "Event not found",
//       });

//       // Check state update
//       const fundsRaised = await crowdFunding.fundsRaised();
//       console.log(`Total funds raised: ${ethers.formatEther(fundsRaised)}`);

//       const investorBalance = await crowdFunding.investorBalances(investor1.address);
//       console.log(`Investor1 balance in contract: ${ethers.formatEther(investorBalance)}`);

//       const pendingTokens = await crowdFunding.pendingEnergyTokens(investor1.address);
//       console.log(`Investor1 pending energy tokens: ${ethers.formatEther(pendingTokens)}`);

//       const contractBalanceAfter = await mockUSDC.balanceOf(await crowdFunding.getAddress());
//       console.log(`Contract USDC balance after: ${ethers.formatEther(contractBalanceAfter)}`);

//       expect(await crowdFunding.fundsRaised()).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await crowdFunding.investorBalances(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await crowdFunding.pendingEnergyTokens(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await mockUSDC.balanceOf(await crowdFunding.getAddress())).to.equal(INVESTMENT_AMOUNT_1);
//       console.log("----- Test completed -----\n");
//     });

//     it("Should mark funding as successful when target amount is reached", async function () {
//       console.log("\n----- Testing funding success when target reached -----");

//       // First investor invests
//       console.log(`Investor1 investing ${ethers.formatEther(INVESTMENT_AMOUNT_1)} MockUSDC...`);
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       console.log("Investor1 investment successful");

//       const fundsRaisedAfterFirst = await crowdFunding.fundsRaised();
//       console.log(`Funds raised after first investment: ${ethers.formatEther(fundsRaisedAfterFirst)}`);

//       // Second investor invests, reaching target
//       console.log(`Investor2 investing ${ethers.formatEther(INVESTMENT_AMOUNT_2)} MockUSDC...`);
//       console.log("This should trigger funding success...");
//       const tx = await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
//       console.log(`Transaction hash: ${tx.hash}`);

//       const receipt = await tx.wait();
//       console.log("Transaction confirmed");

//       // Check for FundingSuccessful event
//       const fundingEvent = await getEventFromTx(receipt!, "FundingSuccessful");
//       console.log("FundingSuccessful event found:", fundingEvent ? "Yes" : "No");

//       // Check state update
//       const fundingStatus = await crowdFunding.fundingStatus();
//       console.log(`Funding status: ${fundingStatus} (0=Active, 1=Successful, 2=Failed)`);

//       const totalRaised = await crowdFunding.fundsRaised();
//       console.log(`Total funds raised: ${ethers.formatEther(totalRaised)}`);

//       // Check that energy tokens were released
//       const energyEvent = await getEventFromTx(receipt!, "EnergyTokensReleased");
//       console.log("EnergyTokensReleased event found:", energyEvent ? "Yes" : "No");

//       const energyTokensReleased = await crowdFunding.energyTokensReleased();
//       console.log(`Energy tokens released: ${energyTokensReleased}`);

//       expect(await crowdFunding.fundingStatus()).to.equal(1); // Successful
//       expect(await crowdFunding.fundsRaised()).to.equal(TARGET_AMOUNT);
//       expect(await crowdFunding.energyTokensReleased()).to.be.true;
//       console.log("----- Test completed -----\n");
//     });

//     it("Should mark funding as failed when investment period ends without reaching target", async function () {
//       console.log("\n----- Testing funding failure after period ends -----");

//       // Invest less than the target amount
//       console.log(`Investor1 investing ${ethers.formatEther(INVESTMENT_AMOUNT_1)} MockUSDC (less than target)...`);
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       console.log("Investment successful");

//       const fundsRaised = await crowdFunding.fundsRaised();
//       console.log(`Total funds raised: ${ethers.formatEther(fundsRaised)}`);
//       console.log(`Target amount: ${ethers.formatEther(TARGET_AMOUNT)}`);

//       // Fast forward past the investment period
//       const proposal = await crowdFunding.proposal();
//       console.log(`Investment period ends at: ${new Date(Number(proposal.investmentPeriod) * 1000)}`);

//       console.log(`Fast-forwarding time to after investment period...`);
//       await time.increaseTo(Number(proposal.investmentPeriod) + 1);
//       const currentTime = await time.latest();
//       console.log(`Current time now: ${new Date(currentTime * 1000)}`);

//       // Update funding status manually
//       console.log("Updating funding status...");
//       const tx = await crowdFunding.updateFundingStatus();
//       console.log(`Transaction hash: ${tx.hash}`);

//       const receipt = await tx.wait();
//       console.log("Transaction confirmed");

//       // Check for FundingFailed event
//       const event = await getEventFromTx(receipt!, "FundingFailed");
//       console.log("FundingFailed event found:", event ? "Yes" : "No");

//       // Check state update
//       const fundingStatus = await crowdFunding.fundingStatus();
//       console.log(`Funding status: ${fundingStatus} (0=Active, 1=Successful, 2=Failed)`);

//       expect(await crowdFunding.fundingStatus()).to.equal(2); // Failed
//       console.log("----- Test completed -----\n");
//     });

//     it("Should revert investment when various conditions aren't met", async function () {
//       // Take a snapshot before modifying time
//       const snapshotId = await ethers.provider.send("evm_snapshot", []);

//       // Deploy a new contract
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       const newContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS,
//         CLAIM_PERIOD,
//       );

//       await expect(newContract.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
//         "INVEST: Security tokens not pledged",
//       );

//       // Invest with zero amount
//       await expect(crowdFunding.connect(investor1).invest(0)).to.be.revertedWith(
//         "INVEST: Amount must be greater than zero",
//       );

//       // Invest after investment period
//       const proposal = await crowdFunding.proposal();
//       await time.increaseTo(Number(proposal.investmentPeriod) + 1);

//       await expect(crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
//         "INVEST: Investment period has ended",
//       );

//       // Instead of setting time back, revert to the previous snapshot
//       await ethers.provider.send("evm_revert", [snapshotId]);

//       // Exceed target amount
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       const exceedAmount = TARGET_AMOUNT - INVESTMENT_AMOUNT_1 + parseEther("1");

//       // Mint more tokens to investor2 for this test
//       await mockUSDC.mint(investor2.address, exceedAmount);
//       await mockUSDC.connect(investor2).approve(await crowdFunding.getAddress(), exceedAmount);

//       await expect(crowdFunding.connect(investor2).invest(exceedAmount)).to.be.revertedWith(
//         "INVEST: Funding target exceeded",
//       );
//     });
//   });

//   describe("Claiming Energy Tokens", function () {
//     beforeEach(async function () {
//       console.log("\n----- Setting up for energy token claiming test -----");

//       // Pledge tokens
//       console.log("Client pledging tokens...");
//       await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//       console.log("Tokens pledged successfully");

//       // Complete funding
//       console.log(`Investor1 investing ${ethers.formatEther(INVESTMENT_AMOUNT_1)} MockUSDC...`);
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       console.log("Investor1 investment successful");

//       console.log(`Investor2 investing ${ethers.formatEther(INVESTMENT_AMOUNT_2)} MockUSDC...`);
//       await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
//       console.log("Investor2 investment successful");

//       const fundingStatus = await crowdFunding.fundingStatus();
//       console.log(`Funding status: ${fundingStatus} (0=Active, 1=Successful, 2=Failed)`);

//       const energyTokensReleased = await crowdFunding.energyTokensReleased();
//       console.log(`Energy tokens released: ${energyTokensReleased}`);
//       console.log("----- Setup complete -----\n");
//     });

//     it("Should allow investors to claim energy tokens", async function () {
//       console.log("\n----- Testing energy token claiming -----");

//       const investorEnergyBalance = await energyToken.balanceOf(investor1.address);
//       console.log(`Investor1 energy token balance before: ${ethers.formatEther(investorEnergyBalance)}`);

//       const pendingTokens = await crowdFunding.pendingEnergyTokens(investor1.address);
//       console.log(`Investor1 pending energy tokens: ${ethers.formatEther(pendingTokens)}`);

//       console.log("Investor1 claiming energy tokens...");
//       const tx = await crowdFunding.connect(investor1).claimEnergyTokens();
//       console.log(`Transaction hash: ${tx.hash}`);

//       const receipt = await tx.wait();
//       console.log("Transaction confirmed");

//       // Check event
//       const event = await getEventFromTx(receipt!, "EnergyTokensClaimed");
//       console.log("Event details:", {
//         investor: event ? event.args.investor : "Event not found",
//         amount: event ? ethers.formatEther(event.args.amount) : "Event not found",
//       });

//       // Check state update
//       const balanceAfter = await energyToken.balanceOf(investor1.address);
//       console.log(`Investor1 energy token balance after: ${ethers.formatEther(balanceAfter)}`);

//       const pendingAfter = await crowdFunding.pendingEnergyTokens(investor1.address);
//       console.log(`Investor1 pending energy tokens after: ${ethers.formatEther(pendingAfter)}`);

//       expect(await energyToken.balanceOf(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await crowdFunding.pendingEnergyTokens(investor1.address)).to.equal(0);
//       console.log("----- Test completed -----\n");
//     });

//     it("Should revert if investor tries to claim twice", async function () {
//       console.log("\n----- Testing double claim prevention -----");

//       // Claim once
//       console.log("Investor1 claiming energy tokens first time...");
//       await crowdFunding.connect(investor1).claimEnergyTokens();
//       console.log("First claim successful");

//       // Try to claim again
//       console.log("Investor1 attempting to claim again (should fail)...");

//       try {
//         await crowdFunding.connect(investor1).claimEnergyTokens();
//         console.log("ERROR: Transaction did not revert as expected");
//       } catch (error: any) {
//         console.log(`Revert reason: ${error.message}`);
//       }

//       await expect(crowdFunding.connect(investor1).claimEnergyTokens()).to.be.revertedWith("No energy tokens to claim");
//       console.log("----- Test completed -----\n");
//     });

//     it("Should revert if funding isn't successful", async function () {
//       // Deploy new contract
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       const newContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS,
//         CLAIM_PERIOD,
//       );

//       await expect(newContract.connect(investor1).claimEnergyTokens()).to.be.revertedWith(
//         "Funding must be successful to claim tokens",
//       );
//     });
//   });

//   describe("Agreement and Milestone Management", function () {
//     beforeEach(async function () {
//       console.log("\n----- Setting up for agreement and milestone test -----");

//       // Pledge tokens
//       console.log("Client pledging tokens...");
//       await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//       console.log("Tokens pledged successfully");

//       // Complete funding
//       console.log(`Investors completing funding with ${ethers.formatEther(TARGET_AMOUNT)} MockUSDC...`);
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
//       console.log("Funding completed successfully");

//       const fundingStatus = await crowdFunding.fundingStatus();
//       console.log(`Funding status: ${fundingStatus} (0=Active, 1=Successful, 2=Failed)`);
//       console.log("----- Setup complete -----\n");
//     });

//     it("Should allow general contractor to sign agreement", async function () {
//       console.log("\n----- Testing agreement signing -----");

//       // Create agreement hash
//       const agreementHash = keccak256(toUtf8Bytes("Agreement terms"));
//       console.log(`Agreement hash: ${agreementHash}`);

//       // Fetch domain separator from the smart contract
//       const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();
//       console.log(`Domain separator: ${domainSeparator}`);

//       // Properly encode message for EIP-712
//       const messageHash = keccak256(
//         AbiCoder.defaultAbiCoder().encode(
//           ["bytes32", "address", "uint256"],
//           [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//         ),
//       );
//       console.log(`Message hash: ${messageHash}`);

//       // Create the final EIP-712 digest
//       const digest = keccak256(concat([toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
//       console.log(`Digest to sign: ${digest}`);

//       // 🔥 SIGNING WITH A WALLET THAT MATCHES THE GENERAL CONTRACTOR 🔥
//       const signers = await ethers.getSigners();
//       let gcIndex = -1;
//       for (let i = 0; i < signers.length; i++) {
//         if ((await signers[i].getAddress()) === (await generalContractor.getAddress())) {
//           gcIndex = i;
//           break;
//         }
//       }

//       console.log(`General contractor is account #${gcIndex}`);
//       if (gcIndex === -1) throw new Error("General contractor account not found");

//       // Use the correct Hardhat account private key
//       const HARDHAT_PRIVATE_KEYS = [
//         "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//         "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//         "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//         "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//         "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // account #4
//       ];

//       const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];
//       const wallet = new ethers.Wallet(gcPrivateKey);
//       console.log(`Wallet from private key: ${wallet.address}`);

//       // Sign the digest directly (NO Ethereum Signed Message prefix!)
//       const signature = wallet.signingKey.sign(digest);
//       console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

//       // Format signature properly
//       const flatSig = concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);
//       console.log(`Formatted signature: ${flatSig}`);

//       // 🔥 Submit signed agreement 🔥
//       console.log("General contractor signing agreement...");
//       await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);

//       // Verify agreement is signed
//       expect(await crowdFunding.gcAgreement()).to.equal(true);
//       console.log(`Agreement signed: ${await crowdFunding.gcAgreement()}`);
//     });

//     it("Should allow auditor to verify milestone", async function () {
//       console.log("\n----- Testing milestone verification -----");

//       // Sign agreement first
//       console.log("Setting up: General contractor signing agreement...");
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("Agreement terms"));
//       const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();

//       const messageHash = ethers.keccak256(
//         ethers.AbiCoder.defaultAbiCoder().encode(
//           ["bytes32", "address", "uint256"],
//           [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//         ),
//       );

//       const digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
//       console.log(`Digest to sign: ${digest}`);

//       // Use predefined Hardhat private keys for signing (similar to the previous fix)
//       const HARDHAT_PRIVATE_KEYS = [
//         "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//         "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//         "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//         "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//       ];

//       // Determine general contractor's index in the signers array
//       let gcIndex = -1;
//       for (let i = 0; i < 4; i++) {
//         if ((await ethers.getSigners())[i].address === (await generalContractor.getAddress())) {
//           gcIndex = i;
//           break;
//         }
//       }

//       console.log(`General contractor is account #${gcIndex}`);
//       const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];

//       // Create a wallet from the private key
//       const wallet = new ethers.Wallet(gcPrivateKey);

//       // Sign the digest directly
//       const signature = wallet.signingKey.sign(digest);
//       console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

//       // Format the signature correctly
//       const flatSig = ethers.concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);
//       console.log(`Formatted signature: ${flatSig}`);

//       console.log("General contractor signing agreement...");
//       await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);
//       console.log("Agreement signed successfully");

//       // Check milestone details before verification
//       const milestoneIndex = 0;
//       const milestoneBefore = await crowdFunding.getMilestoneDetails(milestoneIndex);
//       console.log("Milestone before verification:", {
//         amount: ethers.formatEther(milestoneBefore[0]),
//         verified: milestoneBefore[1],
//         fundsReleased: milestoneBefore[2],
//       });

//       // Verify milestone
//       console.log(`Auditor verifying milestone ${milestoneIndex}...`);
//       const tx = await crowdFunding.connect(auditor).verifyMilestone(milestoneIndex);
//       console.log(`Transaction hash: ${tx.hash}`);

//       const receipt = await tx.wait();
//       console.log("Transaction confirmed");

//       // Check event
//       const event = await getEventFromTx(receipt!, "MilestoneVerified");
//       console.log("Event details:", {
//         milestoneIndex: event ? event.args.milestoneIndex : "Event not found",
//       });

//       // Check state update
//       const milestoneAfter = await crowdFunding.getMilestoneDetails(milestoneIndex);
//       console.log("Milestone after verification:", {
//         amount: ethers.formatEther(milestoneAfter[0]),
//         verified: milestoneAfter[1],
//         fundsReleased: milestoneAfter[2],
//       });

//       expect(milestoneAfter[1]).to.be.true; // verified should be true
//       console.log("----- Test completed -----\n");
//     });

//     it("Should allow general contractor to withdraw funds for verified milestone", async function () {
//       console.log("\n----- Testing general contractor withdrawing funds for verified milestone -----");

//       // Sign agreement
//       console.log("Setting up: General contractor signing agreement...");
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("Agreement terms"));
//       const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();

//       const messageHash = ethers.keccak256(
//         ethers.AbiCoder.defaultAbiCoder().encode(
//           ["bytes32", "address", "uint256"],
//           [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//         ),
//       );

//       const digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
//       console.log(`Digest to sign: ${digest}`);

//       // Use predefined Hardhat private keys for signing
//       const HARDHAT_PRIVATE_KEYS = [
//         "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//         "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//         "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//         "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//       ];

//       // Determine general contractor's index in the signers array
//       let gcIndex = -1;
//       for (let i = 0; i < 4; i++) {
//         if ((await ethers.getSigners())[i].address === (await generalContractor.getAddress())) {
//           gcIndex = i;
//           break;
//         }
//       }

//       console.log(`General contractor is account #${gcIndex}`);
//       const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];

//       // Create a wallet from the private key
//       const wallet = new ethers.Wallet(gcPrivateKey);

//       // Sign the digest directly
//       const signature = wallet.signingKey.sign(digest);
//       console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

//       // Format the signature correctly
//       const flatSig = ethers.concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);
//       console.log(`Formatted signature: ${flatSig}`);

//       console.log("General contractor signing agreement...");
//       await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);
//       console.log("Agreement signed successfully");

//       // Verify milestone
//       const milestoneIndex = 0;
//       console.log(`Verifying milestone ${milestoneIndex}...`);
//       await crowdFunding.connect(auditor).verifyMilestone(milestoneIndex);
//       console.log(`Milestone ${milestoneIndex} verified`);

//       // Get GC's balance before withdrawal
//       const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);
//       console.log(`General contractor balance before withdrawal: ${gcBalanceBefore}`);

//       // Withdraw funds
//       console.log("Withdrawing funds...");
//       const tx = await crowdFunding.connect(generalContractor).withdrawByGC(milestoneIndex);
//       const receipt = await tx.wait();
//       console.log(`Withdrawal transaction confirmed: ${tx.hash}`);

//       // Check event
//       const event = await getEventFromTx(receipt!, "FundsWithdrawn");
//       expect(event).to.not.be.null;
//       expect(event!.args.milestoneIndex).to.equal(milestoneIndex);
//       expect(event!.args.amount).to.equal(MILESTONE_AMOUNTS[milestoneIndex]);

//       // Check state update
//       const milestone = await crowdFunding.getMilestoneDetails(milestoneIndex);
//       expect(milestone[2]).to.be.true; // fundsReleased should be true
//       console.log(`Milestone ${milestoneIndex} fundsReleased: ${milestone[2]}`);

//       // Check GC's balance increased
//       const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
//       console.log(`General contractor balance after withdrawal: ${gcBalanceAfter}`);
//       expect(gcBalanceAfter - gcBalanceBefore).to.equal(MILESTONE_AMOUNTS[milestoneIndex]);

//       console.log("----- Test completed -----\n");
//     });

//     it("Should emit FinalMilestoneAchieved when last milestone is verified", async function () {
//       console.log("\n----- Testing final milestone verification -----");

//       // Sign agreement
//       console.log("Setting up: General contractor signing agreement...");
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("Agreement terms"));
//       const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();

//       const messageHash = ethers.keccak256(
//         ethers.AbiCoder.defaultAbiCoder().encode(
//           ["bytes32", "address", "uint256"],
//           [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//         ),
//       );

//       const digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
//       console.log(`Digest to sign: ${digest}`);

//       // Use predefined Hardhat private keys for signing
//       const HARDHAT_PRIVATE_KEYS = [
//         "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//         "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//         "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//         "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//       ];

//       // Determine general contractor's index in the signers array
//       let gcIndex = -1;
//       for (let i = 0; i < 4; i++) {
//         if ((await ethers.getSigners())[i].address === (await generalContractor.getAddress())) {
//           gcIndex = i;
//           break;
//         }
//       }

//       console.log(`General contractor is account #${gcIndex}`);
//       const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];

//       // Create a wallet from the private key
//       const wallet = new ethers.Wallet(gcPrivateKey);

//       // Sign the digest directly
//       const signature = wallet.signingKey.sign(digest);
//       console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

//       // Format the signature correctly
//       const flatSig = ethers.concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);
//       console.log(`Formatted signature: ${flatSig}`);

//       console.log("General contractor signing agreement...");
//       await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);
//       console.log("Agreement signed successfully");

//       // Verify all milestones except the last one
//       for (let i = 0; i < MILESTONE_AMOUNTS.length - 1; i++) {
//         console.log(`Verifying milestone ${i}...`);
//         await crowdFunding.connect(auditor).verifyMilestone(i);
//         console.log(`Milestone ${i} verified`);
//       }

//       // Verify the last milestone
//       const lastMilestoneIndex = MILESTONE_AMOUNTS.length - 1;
//       console.log(`Verifying last milestone ${lastMilestoneIndex}...`);
//       const tx = await crowdFunding.connect(auditor).verifyMilestone(lastMilestoneIndex);
//       const receipt = await tx.wait();
//       console.log(`Last milestone verified, transaction hash: ${tx.hash}`);

//       // Check event
//       const event = await getEventFromTx(receipt!, "FinalMilestoneAchieved");
//       expect(event).to.not.be.null;
//       console.log("FinalMilestoneAchieved event emitted successfully");

//       // Check state update
//       const finalMilestoneAchieved = await crowdFunding.finalMilestoneAchieved();
//       expect(finalMilestoneAchieved).to.be.true;
//       console.log(`Final milestone achieved state: ${finalMilestoneAchieved}`);

//       // Check creditClaimDeadline is set
//       const currentTime = await time.latest();
//       const claimDeadline = await crowdFunding.creditClaimDeadline();
//       console.log(`Current time: ${currentTime}, Claim deadline: ${claimDeadline}`);
//       expect(claimDeadline).to.closeTo(currentTime + CLAIM_PERIOD, 10); // Allow small time variance

//       console.log("----- Test completed -----\n");
//     });
//   });

//   describe("Extra Fund Requests", function () {
//     const EXTRA_FUND_AMOUNT = parseEther("100");
//     const DESCRIPTION = "Additional materials needed";
//     let requestId: number;

//     beforeEach(async function () {
//       try {
//         console.log("----- Before each: Preparing for test -----");

//         // Pledge tokens
//         console.log("Pledging tokens...");
//         await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//         // Complete funding
//         console.log("Investing in funding...");
//         await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//         await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);

//         // Create agreement hash
//         const agreementHash = keccak256(toUtf8Bytes("Agreement terms"));
//         console.log(`Agreement hash: ${agreementHash}`);

//         // Fetch domain separator from the smart contract
//         const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();
//         console.log(`Domain separator: ${domainSeparator}`);

//         // Properly encode message for EIP-712
//         const messageHash = keccak256(
//           AbiCoder.defaultAbiCoder().encode(
//             ["bytes32", "address", "uint256"],
//             [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//           ),
//         );
//         console.log(`Message hash: ${messageHash}`);

//         // Create the final EIP-712 digest
//         const digest = keccak256(concat([toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
//         console.log(`Digest to sign: ${digest}`);

//         // 🔥 SIGNING WITH A WALLET THAT MATCHES THE GENERAL CONTRACTOR 🔥
//         const signers = await ethers.getSigners();
//         let gcIndex = -1;
//         for (let i = 0; i < signers.length; i++) {
//           if ((await signers[i].getAddress()) === (await generalContractor.getAddress())) {
//             gcIndex = i;
//             break;
//           }
//         }

//         console.log(`General contractor is account #${gcIndex}`);
//         if (gcIndex === -1) throw new Error("General contractor account not found");

//         // Use the correct Hardhat account private key
//         const HARDHAT_PRIVATE_KEYS = [
//           "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//           "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//           "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//           "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//           "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // account #4
//         ];

//         const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];
//         const wallet = new ethers.Wallet(gcPrivateKey);
//         console.log(`Wallet from private key: ${wallet.address}`);

//         // Sign the digest directly (NO Ethereum Signed Message prefix!)
//         const signature = wallet.signingKey.sign(digest);
//         console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

//         // Format signature properly
//         const flatSig = concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);
//         console.log(`Formatted signature: ${flatSig}`);

//         // 🔥 Submit signed agreement 🔥
//         console.log("General contractor signing agreement...");
//         await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);

//         // Verify agreement is signed
//         expect(await crowdFunding.gcAgreement()).to.equal(true);
//         console.log(`Agreement signed: ${await crowdFunding.gcAgreement()}`);
//         // Create extra fund request
//         console.log("Creating extra fund request...");
//         const proposalHash = keccak256(toUtf8Bytes("Extra fund proposal"));

//         // Sign the extra fund request using the same approach as for the agreement
//         const requestDigest = ethers.solidityPackedKeccak256(
//           ["bytes32", "address", "uint256"],
//           [proposalHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//         );

//         console.log("Request digest:", requestDigest);
//         const requestSignature = await wallet.signMessage(requestDigest);

//         // Now create the extra fund request with the signature and correct overrides (empty object)
//         console.log("Requesting extra funds...");
//         const tx = await crowdFunding
//           .connect(generalContractor)
//           .requestExtraFunds(proposalHash, EXTRA_FUND_AMOUNT, DESCRIPTION); // No overrides needed

//         const receipt = await tx.wait();

//         // Capture the requestId from the event
//         const event = await getEventFromTx(receipt!, "ExtraFundRequestCreated");
//         requestId = Number(event!.args.requestId);

//         console.log("Extra fund request created with ID:", requestId);
//         console.log("----- Test setup completed -----");
//       } catch (error) {
//         console.error("Error during setup:", error);
//       }
//     });

//     // Add your test cases here

//     it("Should allow auditor to approve extra fund request for voting", async function () {
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days

//       const tx = await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "ExtraFundRequestApproved");
//       expect(event).to.not.be.null;
//       expect(event!.args.requestId).to.equal(requestId);
//       expect(event!.args.votingDuration).to.equal(votingDuration);

//       // Check state update
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(request[3]).to.be.true; // auditorApproved should be true

//       const currentTime = await time.latest();
//       expect(request[4]).to.closeTo(currentTime + votingDuration, 10); // votingEndTime
//     });

//     it("Should allow investors to vote on approved extra fund requests", async function () {
//       // Approve request
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days
//       await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

//       // Investor1 votes in favor
//       const tx1 = await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, true);
//       const receipt1 = await tx1.wait();

//       // Check event
//       const event1 = await getEventFromTx(receipt1!, "ExtraFundVoteCast");
//       expect(event1).to.not.be.null;
//       expect(event1!.args.requestId).to.equal(requestId);
//       expect(event1!.args.voter).to.equal(investor1.address);
//       expect(event1!.args.support).to.be.true;
//       expect(event1!.args.stake).to.equal(INVESTMENT_AMOUNT_1);

//       // Investor2 votes against
//       const tx2 = await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, false);
//       const receipt2 = await tx2.wait();

//       // Check event
//       const event2 = await getEventFromTx(receipt2!, "ExtraFundVoteCast");
//       expect(event2).to.not.be.null;
//       expect(event2!.args.requestId).to.equal(requestId);
//       expect(event2!.args.voter).to.equal(investor2.address);
//       expect(event2!.args.support).to.be.false;
//       expect(event2!.args.stake).to.equal(INVESTMENT_AMOUNT_2);

//       // Check state update
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(request[5]).to.equal(INVESTMENT_AMOUNT_1); // votesFor
//       expect(request[6]).to.equal(INVESTMENT_AMOUNT_2); // votesAgainst
//     });

//     it("Should execute approved extra fund request after voting period", async function () {
//       // Approve request
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days
//       await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

//       // Investors vote (both in favor for this test)
//       await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, true);
//       await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, true);

//       // Fast forward past voting period
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       await time.increaseTo(Number(request[4]) + 1);

//       // Execute request
//       const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

//       const tx = await crowdFunding.connect(auditor).executeExtraFundRequest(requestId);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "ExtraFundRequestExecuted");
//       expect(event).to.not.be.null;
//       expect(event!.args.requestId).to.equal(requestId);
//       expect(event!.args.approved).to.be.true;

//       // Check state update
//       const updatedRequest = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(updatedRequest[7]).to.be.true; // executed should be true

//       // Check GC's balance increased
//       const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
//       expect(gcBalanceAfter - gcBalanceBefore).to.equal(EXTRA_FUND_AMOUNT);
//     });

//     it("Should reject extra fund request if majority votes against", async function () {
//       // Approve request
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days
//       await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

//       // Investors vote (both against for this test)
//       await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, false);
//       await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, false);

//       // Fast forward past voting period
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       await time.increaseTo(Number(request[4]) + 1);

//       // Execute request
//       const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

//       const tx = await crowdFunding.connect(auditor).executeExtraFundRequest(requestId);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "ExtraFundRequestRejected");
//       expect(event).to.not.be.null;
//       expect(event!.args.requestId).to.equal(requestId);

//       // Check state update
//       const updatedRequest = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(updatedRequest[7]).to.be.true; // executed should be true

//       // Check GC's balance didn't change
//       const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
//       expect(gcBalanceAfter).to.equal(gcBalanceBefore);
//     });
//   });

//   describe("Energy Credits", function () {
//     const ENERGY_TOKEN_AMOUNT = parseEther("100");

//     beforeEach(async function () {
//       // Pledge tokens
//       await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Complete funding
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);

//       // Claim energy tokens
//       await crowdFunding.connect(investor1).claimEnergyTokens();

//       // Sign agreement
//       console.log("Setting up: General contractor signing agreement...");
//       const agreementHash = ethers.keccak256(ethers.toUtf8Bytes("Agreement terms"));
//       const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();

//       const messageHash = ethers.keccak256(
//         ethers.AbiCoder.defaultAbiCoder().encode(
//           ["bytes32", "address", "uint256"],
//           [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//         ),
//       );

//       const digest = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));
//       console.log(`Digest to sign: ${digest}`);

//       // Use predefined Hardhat private keys for signing
//       const HARDHAT_PRIVATE_KEYS = [
//         "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//         "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//         "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//         "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//       ];

//       // Determine general contractor's index in the signers array
//       let gcIndex = -1;
//       for (let i = 0; i < 4; i++) {
//         if ((await ethers.getSigners())[i].address === (await generalContractor.getAddress())) {
//           gcIndex = i;
//           break;
//         }
//       }

//       console.log(`General contractor is account #${gcIndex}`);
//       const gcPrivateKey = HARDHAT_PRIVATE_KEYS[gcIndex];

//       // Create a wallet from the private key
//       const wallet = new ethers.Wallet(gcPrivateKey);

//       // Sign the digest directly
//       const signature = wallet.signingKey.sign(digest);
//       console.log(`Signature components: r=${signature.r}, s=${signature.s}, v=${signature.v}`);

//       // Format the signature correctly
//       const flatSig = ethers.concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);
//       console.log(`Formatted signature: ${flatSig}`);

//       console.log("General contractor signing agreement...");
//       await crowdFunding.connect(generalContractor).signAgreement(agreementHash, flatSig);
//       console.log("Agreement signed successfully");

//       // Complete all milestones
//       for (let i = 0; i < MILESTONE_AMOUNTS.length; i++) {
//         await crowdFunding.connect(auditor).verifyMilestone(i);
//       }

//       // Approve energy token spending
//       await energyToken.connect(investor1).approve(await crowdFunding.getAddress(), ENERGY_TOKEN_AMOUNT);
//     });

//     it("Should allow investors to burn energy tokens for credits", async function () {
//       const tx = await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);
//       const receipt = await tx.wait();

//       // Check events
//       const burnEvent = await getEventFromTx(receipt!, "EnergyTokensBurned");
//       expect(burnEvent).to.not.be.null;
//       expect(burnEvent!.args.investor).to.equal(investor1.address);
//       expect(burnEvent!.args.amount).to.equal(ENERGY_TOKEN_AMOUNT);

//       const claimEvent = await getEventFromTx(receipt!, "EnergyCreditsClaimed");
//       expect(claimEvent).to.not.be.null;
//       expect(claimEvent!.args.investor).to.equal(investor1.address);

//       // Default rate is 1:1
//       const defaultRate = await crowdFunding.energyCreditRate();
//       expect(claimEvent!.args.credits).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate);

//       // Check state update
//       expect(await crowdFunding.totalTokensBurned()).to.equal(ENERGY_TOKEN_AMOUNT);

//       const redemptionDetails = await crowdFunding
//         .connect(investor1)
//         .getEnergyCreditRedemptionDetails(investor1.address);
//       expect(redemptionDetails[0]).to.equal(ENERGY_TOKEN_AMOUNT); // tokensBurned
//       expect(redemptionDetails[1]).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate); // creditsEarned
//       expect(redemptionDetails[2]).to.be.false; // redeemed
//       expect(redemptionDetails[3]).to.be.false; // verified
//     });

//     it("Should allow energy provider to verify energy credit redemption", async function () {
//       // Burn tokens first
//       await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);

//       // Verify redemption
//       const tx = await crowdFunding.connect(energyProvider).verifyEnergyCreditRedemption(investor1.address);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EnergyCreditsVerified");
//       expect(event).to.not.be.null;
//       expect(event!.args.investor).to.equal(investor1.address);

//       const defaultRate = await crowdFunding.energyCreditRate();
//       expect(event!.args.creditsEarned).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate);

//       // Check state update
//       const redemptionDetails = await crowdFunding
//         .connect(investor1)
//         .getEnergyCreditRedemptionDetails(investor1.address);
//       expect(redemptionDetails[3]).to.be.true; // verified should be true
//     });

//     it("Should allow owner to update energy credit rate", async function () {
//       const newRate = 2; // 1:2 conversion rate

//       const tx = await crowdFunding.setEnergyCreditRate(newRate);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EnergyCreditRateUpdated");
//       expect(event).to.not.be.null;
//       expect(event!.args.newRate).to.equal(newRate);

//       // Check state update
//       expect(await crowdFunding.energyCreditRate()).to.equal(newRate);

//       // Test that the new rate is used
//       await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);

//       const redemptionDetails = await crowdFunding
//         .connect(investor1)
//         .getEnergyCreditRedemptionDetails(investor1.address);
//       // expect(redemptionDetails[1]).to.equal(ENERGY_TOKEN_AMOUNT * newRate); // creditsEarned with new rate
//     });
//   });

//   describe("Emergency Stop", function () {
//     beforeEach(async function () {
//       // Pledge tokens
//       await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//     });

//     it("Should allow owner to toggle emergency stop", async function () {
//       const tx = await crowdFunding.toggleEmergencyStop();
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EmergencyToggled");
//       expect(event).to.not.be.null;
//       expect(event!.args.stopped).to.be.true;

//       // Check state update
//       expect(await crowdFunding.emergencyStop()).to.be.true;

//       // Toggle back
//       const tx2 = await crowdFunding.toggleEmergencyStop();
//       const receipt2 = await tx2.wait();

//       // Check event
//       const event2 = await getEventFromTx(receipt2!, "EmergencyToggled");
//       expect(event2).to.not.be.null;
//       expect(event2!.args.stopped).to.be.false;

//       // Check state update
//       expect(await crowdFunding.emergencyStop()).to.be.false;
//     });

//     it("Should prevent investing when emergency stop is active", async function () {
//       // Enable emergency stop
//       await crowdFunding.toggleEmergencyStop();

//       // Try to invest
//       await expect(crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
//         "Contract is in emergency stop",
//       );
//     });
//   });

//   describe("Refund Claims", function () {
//     beforeEach(async function () {
//       // Pledge tokens
//       await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Partial funding
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

//       // Fast forward past the investment period to make funding fail
//       const proposal = await crowdFunding.proposal();
//       await time.increaseTo(Number(proposal.investmentPeriod) + 1);

//       // Update funding status
//       await crowdFunding.updateFundingStatus();
//     });

//     it("Should allow investors to claim refunds when funding fails", async function () {
//       const investorBalanceBefore = await mockUSDC.balanceOf(investor1.address);

//       const tx = await crowdFunding.connect(investor1).claimRefund();
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "RefundClaimed");
//       expect(event).to.not.be.null;
//       expect(event!.args.investor).to.equal(investor1.address);
//       expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

//       // Check state update
//       expect(await crowdFunding.hasWithdrawnRefund(investor1.address)).to.be.true;

//       // Check investor's balance increased
//       const investorBalanceAfter = await mockUSDC.balanceOf(investor1.address);
//       expect(investorBalanceAfter - investorBalanceBefore).to.equal(INVESTMENT_AMOUNT_1);
//     });

//     it("Should revert if investor tries to claim refund twice", async function () {
//       // Claim once
//       await crowdFunding.connect(investor1).claimRefund();

//       // Try to claim again
//       await expect(crowdFunding.connect(investor1).claimRefund()).to.be.revertedWith("Refund already claimed");
//     });

//     it("Should revert if funding hasn't failed", async function () {
//       console.log("\n----- Testing refund claim prevention when funding is successful -----");

//       // Deploy new contract with successful funding
//       console.log("Deploying a new CrowdFunding contract for this test...");
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       const newContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS,
//         CLAIM_PERIOD,
//       );
//       console.log(`New CrowdFunding contract deployed to: ${await newContract.getAddress()}`);

//       // IMPORTANT: Grant the MINTER_ROLE to the new contract
//       console.log("Granting MINTER_ROLE to the new contract...");
//       await energyToken.grantRole(await energyToken.MINTER_ROLE(), await newContract.getAddress());

//       // Set up tokens for this test
//       console.log("Setting up tokens for the new contract...");
//       await securityToken.mint(client.address, TARGET_AMOUNT);
//       await securityToken.connect(client).approve(await newContract.getAddress(), TARGET_AMOUNT);
//       await newContract.connect(client).pledgeTokens(TARGET_AMOUNT);
//       console.log("Client pledged tokens to new contract");

//       // Successful funding
//       console.log("Completing successful funding on new contract...");
//       await mockUSDC.mint(investor1.address, TARGET_AMOUNT);
//       await mockUSDC.connect(investor1).approve(await newContract.getAddress(), TARGET_AMOUNT);
//       await newContract.connect(investor1).invest(TARGET_AMOUNT);
//       console.log("Funding completed successfully");

//       const fundingStatus = await newContract.fundingStatus();
//       console.log(`Funding status: ${fundingStatus} (0=Active, 1=Successful, 2=Failed)`);

//       // Try to claim refund
//       console.log("Investor1 attempting to claim refund on successfully funded contract (should fail)...");

//       try {
//         await newContract.connect(investor1).claimRefund();
//         console.log("ERROR: Transaction did not revert as expected");
//       } catch (error: any) {
//         console.log(`Revert reason: ${error.message}`);
//       }

//       await expect(newContract.connect(investor1).claimRefund()).to.be.revertedWith("Funding has not failed");
//       console.log("----- Test completed -----\n");
//     });
//   });
// });
