import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat";

const checkInvestment = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers } = hre;

  console.log("🚀 Initializing investment process...");

  // Get signers
  const [
    adminSigner,
    //auditorSigner,
    clientSigner,
    //generalContractorSigner,
    investorSigner1,
    investorSigner2,
    //investorSigner3,
  ] = await hre.ethers.getSigners();
  console.log("👥 Signers retrieved successfully.");

  // Fetch contract addresses
  console.log("🔍 Fetching deployed contract addresses...");
  const securityAddress = (await deployments.get("SecurityToken")).address;
  const utilityAddress = (await deployments.get("UtilityToken")).address;
  const crowdFundingAddress = (await deployments.get("CrowdFunding")).address;
  const energyAddress = (await deployments.get("EnergyToken")).address;

  // Fetching deployed contract instances
  console.log("📜 Retrieving contract instances...");
  const securityToken = await ethers.getContractAt("SecurityToken", securityAddress);
  const utilityToken = await ethers.getContractAt("UtilityToken", utilityAddress);
  const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingAddress);
  const energyToken = await ethers.getContractAt("EnergyToken", energyAddress);

  // Link CrowdFunding contract to EnergyToken
  console.log(`🔗 Linking CrowdFunding to EnergyToken by ${adminSigner.address}...`);
  const tx = await energyToken.connect(adminSigner).setCrowdFundingContract(crowdFundingAddress);
  await tx.wait();
  console.log("✅ EnergyToken successfully linked to CrowdFunding.");

  console.log("📢 === Starting CrowdFunding Investment Process ===");

  // Step 1: Client pledges SecurityTokens
  console.log("\n🔵 Step 1: Client Pledges SecurityTokens");

  const proposal = await crowdFunding.proposal();
  const targetAmount = proposal.targetAmount;
  console.log(`🎯 Target funding amount: ${ethers.formatUnits(targetAmount, 18)} tokens`);

  await securityToken.connect(clientSigner).transfer(clientSigner.address, targetAmount);
  console.log(`✅ Transferred ${ethers.formatUnits(targetAmount, 18)} SecurityTokens to Client.`);

  // Verify client balance
  const clientSecurityBalance = await securityToken.balanceOf(clientSigner.address);
  console.log(`💰 Client's current SecurityToken balance: ${ethers.formatUnits(clientSecurityBalance, 18)} tokens`);

  if (clientSecurityBalance < targetAmount) {
    console.warn("⚠️ Warning: Client does not have sufficient SecurityTokens.");
  }

  // Client approves and pledges tokens
  await securityToken.connect(clientSigner).approve(crowdFundingAddress, targetAmount);
  console.log("✅ Approved SecurityTokens for CrowdFunding contract.");

  await crowdFunding.connect(clientSigner).pledgeTokens(targetAmount);
  console.log("✅ Tokens pledged successfully.");

  // Check contract balance
  const contractEnergyBalance = await energyToken.balanceOf(crowdFundingAddress);
  console.log(
    `📊 Contract's EnergyToken balance after pledge: ${ethers.formatUnits(contractEnergyBalance, 18)} tokens`,
  );

  // Step 2: Transfer UtilityTokens to investors
  console.log("\n🟡 Step 2: Preparing Investors with UtilityTokens");
  const investorAmount = ethers.parseUnits("200", 18);
  await utilityToken.connect(adminSigner).transfer(investorSigner1.address, investorAmount);
  console.log("✅ Transferred UtilityTokens to Investor 1.");

  await utilityToken.connect(adminSigner).transfer(investorSigner2.address, investorAmount);
  console.log("✅ Transferred UtilityTokens to Investor 2.");

  // Step 3: Investors approve contract spending
  console.log("\n🟢 Step 3: Investors Approve UtilityTokens");
  const investorApprovalAmount = ethers.parseUnits("100", 18);

  await utilityToken.connect(investorSigner1).approve(crowdFundingAddress, investorApprovalAmount);
  console.log("✅ Investor 1 approved UtilityTokens for investment.");

  await utilityToken.connect(investorSigner2).approve(crowdFundingAddress, investorApprovalAmount);
  console.log("✅ Investor 2 approved UtilityTokens for investment.");

  // Step 4: Investors invest in CrowdFunding
  console.log("\n🟣 Step 4: Investors Pledge UtilityTokens");
  await crowdFunding.connect(investorSigner1).invest(investorApprovalAmount);
  console.log("✅ Investor 1 invested UtilityTokens.");

  await crowdFunding.connect(investorSigner2).invest(investorApprovalAmount);
  console.log("✅ Investor 2 invested UtilityTokens.");

  // Step 5: Check final contract balance
  const contractUtilityBalance = await utilityToken.balanceOf(crowdFundingAddress);
  console.log(`📊 Contract's final UtilityToken balance: ${ethers.formatUnits(contractUtilityBalance, 18)} tokens`);

  console.log("🎉 === Investment Process Completed Successfully! ===");
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

// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import hre from "hardhat";

// const checkInvestment = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployments, getNamedAccounts, ethers } = hre;

//   // Get signers instead of using hardcoded addresses
//   const [
//     adminSigner,
//     auditorSigner,
//     clientSigner,
//     generalContractorSigner,
//     investorSigner1,
//     investorSigner2,
//     investorSigner3,
//   ] = await hre.ethers.getSigners();

//   // Fetch contract addresses dynamically from deployments

//   const securityAddress = (await deployments.get("SecurityToken")).address;
//   const utilityAddress = (await deployments.get("UtilityToken")).address;
//   const crowdFundingAddress = (await deployments.get("CrowdFunding")).address;
//   const energyAddress = (await deployments.get("EnergyToken")).address;

//   // Fetching deployed contract instances
//   const securityToken = await ethers.getContractAt("UtilityToken", securityAddress);
//   const utilityToken = await ethers.getContractAt("UtilityToken", utilityAddress);
//   const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingAddress);
//   const energyToken = await ethers.getContractAt("EnergyToken", energyAddress);
//   //const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingAddress);
//   // Set CrowdFunding contract in EnergyToken

//   console.log(`🔗 Linking CrowdFunding to EnergyToken by ${adminSigner.address}...`);
//   const tx = await energyToken.connect(adminSigner).setCrowdFundingContract(crowdFundingAddress);
//   await tx.wait();
//   console.log(`💥 EnergyToken successfully linked to CrowdFunding by ${adminSigner.address}`);

//   console.log("=== Starting CrowdFunding Investment Process ===");

//   // Step 1: Client pledges SecurityTokens to ensure sufficient funds for all investors
//   console.log("\n--- Step 1: Client Pledges SecurityTokens ---");

//   const proposal = await crowdFunding.proposal();
//   const targetAmount = proposal.targetAmount;

//   console.log(`Target funding amount: ${ethers.formatUnits(targetAmount, 18)} tokens`);

//   const approvalAmount = targetAmount;

//   await securityToken.connect(clientSigner).transfer(clientSigner.address, approvalAmount);
//   console.log(`✅ Transferred ${ethers.formatUnits(approvalAmount, 18)} SecurityTokens to Client`);

//   // Verify if client has enough security tokens to pledge
//   const clientSecurityBalance = await securityToken.balanceOf(clientSigner.address);
//   console.log(`Client's current security token balance: ${ethers.formatUnits(clientSecurityBalance, 18)} tokens`);

//   if (clientSecurityBalance < approvalAmount) {
//     console.log(
//       `Warning: Client does not have sufficient security tokens. Has ${ethers.formatUnits(clientSecurityBalance, 18)}, needs ${ethers.formatUnits(approvalAmount, 18)}`,
//     );
//   }

//   // Client approves the required amount to be pledged
//   await securityToken.connect(clientSigner).approve(crowdFundingAddress, approvalAmount);
//   console.log(`✅ Approved ${ethers.formatUnits(approvalAmount, 18)} SecurityTokens for the CrowdFunding contract`);

//   await crowdFunding.connect(clientSigner).pledgeTokens(approvalAmount);
//   console.log("✅ Tokens pledged successfully");

//   // Check if energy tokens are correctly updated
//   const contractEnergyBalance = await energyToken.balanceOf(crowdFundingAddress);
//   console.log(`Contract's energy token balance after pledge: ${ethers.formatUnits(contractEnergyBalance, 18)} tokens`);

//   //  const adminBalance = await utilityToken.balanceOf(adminSigner.address);

//   console.log("\n--- Transferring UtilityTokens to Investors ---");
//   await utilityToken.connect(adminSigner).transfer(adminSigner.address, approvalAmount);
//   console.log(`✅ Transferred ${ethers.formatUnits(approvalAmount, 18)} utilityTokens(MockUSDC to admin`);

//   // Step 2: Prepare investors with UtilityTokens for investment
//   console.log("\n--- Step 2: Prepare Investors with UtilityTokens ---");

//   const investorAmount = ethers.parseUnits("200", 18);
//   await utilityToken.connect(adminSigner).transfer(investorSigner1.address, investorAmount);
//   console.log(`✅ Transferred ${ethers.formatUnits(investorAmount, 18)} UtilityTokens to General Contractor`);

//   await utilityToken.connect(adminSigner).transfer(investorSigner2.address, investorAmount);
//   console.log(`✅ Transferred ${ethers.formatUnits(investorAmount, 18)} UtilityTokens to Client`);

//   // Step 3: Investors approve the contract to spend their UtilityTokens
//   console.log("\n--- Step 3: Investors Approve UtilityTokens ---");

//   const investorApprovalAmount = ethers.parseUnits("100", 18); // Example investment amount

//   await utilityToken.connect(investorSigner1).approve(crowdFundingAddress, investorApprovalAmount);
//   console.log(`✅ investor1 approved ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens for investment`);

//   await utilityToken.connect(investorSigner2).approve(crowdFundingAddress, investorApprovalAmount);
//   console.log(`✅ investor2 approved ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens for investment`);

//   // Step 4: Investors transfer(invest) their UtilityTokens to the CrowdFunding contract
//   console.log("\n--- Step 4: Investors Pledge UtilityTokens ---");

//   await crowdFunding.connect(investorSigner1).invest(investorApprovalAmount);
//   console.log(`✅ investor1 pledged ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens`);

//   await crowdFunding.connect(investorSigner2).invest(investorApprovalAmount);
//   console.log(`✅ investor2 pledged ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens`);

//   // Step 5: Check contract's final balance of UtilityTokens
//   const contractUtilityBalance = await utilityToken.balanceOf(crowdFundingAddress);
//   console.log(`Contract's final UtilityToken balance: ${ethers.formatUnits(contractUtilityBalance, 18)} tokens`);

//   console.log("=== Investment Process Completed ===");
// };

// const main = async () => {
//   await checkInvestment(hre);
// };

// main().catch(error => {
//   console.error(error);
//   process.exit(1);
// });
