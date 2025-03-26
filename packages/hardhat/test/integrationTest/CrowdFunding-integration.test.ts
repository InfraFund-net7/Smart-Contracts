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
  const milestoneAmounts = [ethers.parseEther("300"), ethers.parseEther("400"), ethers.parseEther("200")];
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
      // Handle the potential null value from getBlock()
      const deadlineTimestamp = await crowdFunding.creditClaimDeadline();
      console.log(`creditClaimDeadline: ${deadlineTimestamp}`);
      const latestBlock = await ethers.provider.getBlock("latest");
      // Check if block is null before accessing its timestamp
      if (latestBlock === null) {
        console.log("Could not retrieve latest block");
        return;
      }
      console.log(`Credit claim deadline: ${new Date(Number(deadlineTimestamp) * 1000).toLocaleString()}`);

      // General contractor withdraws funds for final milestone
      console.log(
        `General contractor withdrawing ${ethers.formatEther(milestone2.amount)} USDC for final milestone...`,
      );
      await crowdFunding.connect(generalContractor).withdrawByGC(2);
      console.log(
        `General contractor USDC balance: ${ethers.formatEther(await mockUSDC.balanceOf(await generalContractor.getAddress()))} USDC`,
      );

      // // Complete the final milestone (auditor marks it as complete)
      // console.log("Auditor completing the final milestone...");
      // await crowdFunding.connect(auditor).completeFinalMilestone();
      // console.log(`Final milestone completed: ${await crowdFunding.finalMilestoneAchieved()}`);

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
      console.log(`Target funding amount: ${ethers.formatEther(targetAmount)} USDC`);

      // Client pledges security tokens
      console.log("Client pledging security tokens...");
      await securityToken.connect(client).approve(crowdFundingAddress, targetAmount);
      await crowdFunding.connect(client).pledgeTokens(targetAmount);

      // Investor invests a small amount
      const investAmount = ethers.parseEther("500");
      console.log(
        `Investor 1 investing ${ethers.formatEther(investAmount)} USDC (deliberately less than target to test refund)...`,
      );
      await mockUSDC.connect(investor1).approve(crowdFundingAddress, investAmount);
      await crowdFunding.connect(investor1).invest(investAmount);

      // Log the funding gap
      const fundingGap = targetAmount - investAmount;
      console.log(`Funding gap: ${ethers.formatEther(fundingGap)} USDC needed to reach target`);
      console.log(
        `Funds raised: ${ethers.formatEther(await crowdFunding.fundsRaised())} USDC (${((Number(investAmount) / Number(targetAmount)) * 100).toFixed(2)}% of target)`,
      );

      // Fast forward time past investment period to make funding fail
      console.log(`Fast-forwarding time by ${investmentPeriod + 1} seconds to end investment period...`);
      await time.increase(investmentPeriod + 1);

      // Call updateFundingStatus to update the status
      console.log("Updating funding status...");
      await crowdFunding.updateFundingStatus();

      // Verify funding failed
      expect(await crowdFunding.fundingStatus()).to.equal(2); // 2 is Failed
      console.log(
        `Funding status: ${await crowdFunding.fundingStatus()} (Failed - as expected since target not reached)`,
      );

      console.log("Investor 1 claiming refund of entire investment...");
      await crowdFunding.connect(investor1).claimRefund();

      // Verify investor received funds back
      const investorBalance = await mockUSDC.balanceOf(await investor1.getAddress());
      console.log(`Investor 1 USDC balance after refund: ${ethers.formatEther(investorBalance)} USDC`);
      expect(investorBalance).to.equal(investAmount);

      console.log("Refund successfully claimed - test passed");
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

      // Verify and complete all milestones
      console.log("Auditor verifying and completing all milestones...");
      await crowdFunding.connect(auditor).verifyMilestone(0);
      await crowdFunding.connect(auditor).verifyMilestone(1);
      await crowdFunding.connect(auditor).verifyMilestone(2);
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
