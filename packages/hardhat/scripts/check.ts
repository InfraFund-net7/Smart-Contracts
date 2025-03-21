import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat";

// Define all the amounts and settings as variables for easy configuration
const INVESTOR_1_AMOUNT = "600"; // Amount of UtilityTokens for Investor 1
const INVESTOR_2_AMOUNT = "600"; // Amount of UtilityTokens for Investor 2
const INVESTOR_1_APPROVAL_AMOUNT = "800"; // Amount of UtilityTokens Investor 1 will approve for investment
const INVESTOR_2_APPROVAL_AMOUNT = "700"; // Amount of UtilityTokens Investor 2 will approve for investment
//const SECURITY_TOKEN_AMOUNT = "500"; // Security tokens client needs to pledge (example)
//const GAS_LIMIT = 1000000; // Optional, depending on how you're handling transactions

const checkInvestment = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers } = hre;

  console.log("\n============================================================");
  console.log("🚀 Initializing Investment Process");
  console.log("============================================================\n");

  /* eslint-disable */
  // Get signers
  const [
    adminSigner,
    auditorSigner,
    clientSigner,
    generalContractorSigner,
    investorSigner1,
    investorSigner2,
    investorSigner3,
  ] = await hre.ethers.getSigners();
  console.log("👥 Signers retrieved successfully.\n");
  /* eslint-enable */

  console.log("🔍 Fetching deployed contract addresses...");
  const securityAddress = (await deployments.get("SecurityToken")).address;
  const utilityAddress = (await deployments.get("UtilityToken")).address;
  const crowdFundingAddress = (await deployments.get("CrowdFunding")).address;
  const energyAddress = (await deployments.get("EnergyToken")).address;

  console.log("📜 Retrieving contract instances...");
  const securityToken = await ethers.getContractAt("SecurityToken", securityAddress);
  const utilityToken = await ethers.getContractAt("UtilityToken", utilityAddress);
  const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingAddress);
  const energyToken = await ethers.getContractAt("EnergyToken", energyAddress);

  console.log("🔗 Linking CrowdFunding to EnergyToken...");
  const tx = await energyToken.connect(adminSigner).setCrowdFundingContract(crowdFundingAddress);
  await tx.wait();
  console.log("✅ EnergyToken successfully linked to CrowdFunding.\n");

  console.log("============================================================");
  console.log("📢 === Starting CrowdFunding Investment Process ===");
  console.log("============================================================\n");

  // Step 1: Client pledges SecurityTokens
  console.log("------------------------------------------------------------");
  console.log("🔵 Step 1: Client Pledges SecurityTokens");
  console.log("------------------------------------------------------------\n");

  const proposal = await crowdFunding.proposal();
  const targetAmount = proposal.targetAmount;
  console.log(`🎯 Target funding amount: ${ethers.formatUnits(targetAmount, 18)} tokens`);

  // Check client balance
  const clientSecurityBalance = await securityToken.balanceOf(clientSigner.address);
  console.log(`💰 Client's SecurityToken balance: ${ethers.formatUnits(clientSecurityBalance, 18)} tokens`);

  if (clientSecurityBalance < targetAmount) {
    console.warn("⚠️ Warning: Insufficient SecurityTokens!");
  }

  await securityToken.connect(clientSigner).approve(crowdFundingAddress, targetAmount);
  console.log("✅ Approved SecurityTokens for CrowdFunding contract.");

  await crowdFunding.connect(clientSigner).pledgeTokens(targetAmount);
  console.log(`✅ Pledged ${ethers.formatUnits(targetAmount, 18)} tokens.\n`);

  // Step 2: Transfer UtilityTokens to investors
  console.log("------------------------------------------------------------");
  console.log("🟡 Step 2: Preparing Investors with UtilityTokens");
  console.log("------------------------------------------------------------\n");

  // Convert amounts to wei (using ethers.parseUnits to handle decimals properly)
  const investor1Amount = ethers.parseUnits(INVESTOR_1_AMOUNT, 18);
  const investor2Amount = ethers.parseUnits(INVESTOR_2_AMOUNT, 18);

  const investor1AmountFormatted = ethers.formatUnits(investor1Amount, 18);
  const investor2AmountFormatted = ethers.formatUnits(investor2Amount, 18);

  await utilityToken.connect(adminSigner).transfer(investorSigner1.address, investor1Amount);
  console.log(`✅ Transferred ${investor1AmountFormatted} UtilityTokens to Investor 1.`);

  await utilityToken.connect(adminSigner).transfer(investorSigner2.address, investor2Amount);
  console.log(`✅ Transferred ${investor2AmountFormatted} UtilityTokens to Investor 2.\n`);

  // Step 3: Investors approve contract spending
  console.log("------------------------------------------------------------");
  console.log("🟢 Step 3: Investors Approve UtilityTokens");
  console.log("------------------------------------------------------------\n");

  // Convert approval amounts to wei
  const investor1ApprovalAmount = ethers.parseUnits(INVESTOR_1_APPROVAL_AMOUNT, 18);
  const investor2ApprovalAmount = ethers.parseUnits(INVESTOR_2_APPROVAL_AMOUNT, 18);

  const investor1ApprovalAmountFormatted = ethers.formatUnits(investor1ApprovalAmount, 18);
  const investor2ApprovalAmountFormatted = ethers.formatUnits(investor2ApprovalAmount, 18);

  await utilityToken.connect(investorSigner1).approve(crowdFundingAddress, investor1ApprovalAmount);
  console.log(`✅ Investor 1 approved ${investor1ApprovalAmountFormatted} UtilityTokens.`);

  await utilityToken.connect(investorSigner2).approve(crowdFundingAddress, investor2ApprovalAmount);
  console.log(`✅ Investor 2 approved ${investor2ApprovalAmountFormatted} UtilityTokens.\n`);

  // Step 4: Investors invest in CrowdFunding
  console.log("------------------------------------------------------------");
  console.log("🟣 Step 4: Investors Invest in CrowdFunding");
  console.log("------------------------------------------------------------\n");

  await crowdFunding.connect(investorSigner1).invest(investor1ApprovalAmount);
  console.log(`✅ Investor 1 invested ${investor1ApprovalAmountFormatted} UtilityTokens.`);

  await crowdFunding.connect(investorSigner2).invest(investor2ApprovalAmount);
  console.log(`✅ Investor 2 invested ${investor2ApprovalAmountFormatted} UtilityTokens.\n`);

  // Step 5: Check final contract balance
  console.log("------------------------------------------------------------");
  console.log("📊 Step 5: Final Contract Balance");
  console.log("------------------------------------------------------------\n");

  const contractEnergyBalance = await energyToken.balanceOf(crowdFundingAddress);
  console.log(`📊 Final UtilityToken balance: ${ethers.formatUnits(contractEnergyBalance, 18)} tokens`);

  console.log("\n============================================================");
  console.log("🎉 === Investment Process Completed Successfully! ===");
  console.log("============================================================\n");
};

const main = async () => {
  try {
    await checkInvestment(hre);
  } catch (error) {
    console.error("❌ Error encountered:", error);
    process.exit(1);
  }
};

main();
