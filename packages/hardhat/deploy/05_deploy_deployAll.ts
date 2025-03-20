import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  // Import ethers properly

  // Get signers instead of using hardcoded addresses
  const signers = await (hre as any).ethers.getSigners();
  const deploySigner = signers[0]; // Use the first signer as the deployer for everything
  const clientSigner = signers[1];
  const auditorSigner = signers[2];
  const generalContractorSigner = signers[3];

  console.log(`Using deployer address: ${deploySigner.address}`);
  console.log(`Using client address: ${clientSigner.address}`);
  console.log(`Using auditor address: ${auditorSigner.address}`);
  console.log(`Using general contractor address: ${generalContractorSigner.address}`);
  console.log("----------------------------------------------------------------------------");

  // 1. Deploy SecurityToken
  console.log("🚀 Deploying SecurityToken...");
  const securityTokenDeployment = await deploy("SecurityToken", {
    from: clientSigner.address,
    args: [hre.ethers.parseEther("1000000")],
    log: true,
    autoMine: true,
  });

  await hre.ethers.getContractAt("SecurityToken", securityTokenDeployment.address, deploySigner);
  console.log(`🔑 SecurityToken deployed at: ${securityTokenDeployment.address}`);
  console.log(`👤 Deployed by: ${clientSigner.address}`);
  console.log("----------------------------------------------------------------------------");

  // 2. Deploy UtilityToken
  console.log("🚀 Deploying UtilityToken...");
  const utilityTokenDeployment = await deploy("UtilityToken", {
    from: auditorSigner.address, // Use the same deployer for all contracts
    args: [hre.ethers.parseEther("1000000")],
    log: true,
    autoMine: true,
  });

  await hre.ethers.getContractAt("UtilityToken", utilityTokenDeployment.address, deploySigner);
  console.log(`💸 UtilityToken deployed at: ${utilityTokenDeployment.address}`);
  console.log(`👤 Deployed by: ${auditorSigner.address}`);
  console.log("----------------------------------------------------------------------------");

  // 3. Deploy EnergyToken (without CrowdFunding address)
  console.log("🚀 Deploying EnergyToken...");
  const energyTokenDeployment = await deploy("EnergyToken", {
    from: auditorSigner.address, // Use the same deployer for all contracts
    args: ["EnergyToken", "ENG"],
    log: true,
    autoMine: true,
  });

  const energyToken = await hre.ethers.getContractAt("EnergyToken", energyTokenDeployment.address, deploySigner);
  console.log(`⚡ EnergyToken deployed at: ${energyTokenDeployment.address}`);
  console.log(`👤 Deployed by: ${auditorSigner.address}`);
  console.log("----------------------------------------------------------------------------");

  // 4. Deploy CrowdFunding
  console.log("🚀 Deploying CrowdFunding...");
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const investmentPeriod = currentTimestamp + 60 * 60 * 24 * 30; // 30 days from now
  const targetAmount = hre.ethers.parseEther("1000");
  const milestoneAmounts = [hre.ethers.parseEther("500"), hre.ethers.parseEther("500")];

  const crowdFundingDeployment = await deploy("CrowdFunding", {
    from: auditorSigner.address, // Use the same deployer for all contracts
    args: [
      securityTokenDeployment.address,
      utilityTokenDeployment.address,
      energyTokenDeployment.address,
      investmentPeriod,
      targetAmount,
      auditorSigner.address,
      generalContractorSigner.address,
      clientSigner.address,
      milestoneAmounts,
    ],
    log: true,
    autoMine: true,
  });

  await hre.ethers.getContractAt("CrowdFunding", crowdFundingDeployment.address, deploySigner);
  console.log(`🏗️ CrowdFunding deployed at: ${crowdFundingDeployment.address}`);
  console.log(`👤 Deployed by: ${auditorSigner.address}`);
  console.log("----------------------------------------------------------------------------");

  // 5. Set CrowdFunding contract in EnergyToken
  console.log("🔗 Linking CrowdFunding to EnergyToken...");

  try {
    // Make sure we're using the owner of the EnergyToken contract
    const tx = await energyToken.setCrowdFundingContract(crowdFundingDeployment.address);
    await tx.wait();
    console.log(`💥 EnergyToken successfully linked to CrowdFunding contract at: ${crowdFundingDeployment.address}`);
  } catch (error) {
    console.error("❌ Failed to set CrowdFunding contract in EnergyToken:", error);

    console.log("🔍 Checking the owner of the EnergyToken contract...");

    try {
      // This assumes the EnergyToken contract has an owner() function
      const owner = await energyToken.owner();
      console.log(`ℹ️ The owner of EnergyToken is: ${owner}`);
      console.log(`ℹ️ Our deployer address is: ${auditorSigner.address}`);
    } catch (ownerError) {
      console.error("⚠️ Could not check owner:", ownerError);
    }
  }
};
console.log("----------------------------------------------------------------------------");

export default deployAll;
deployAll.tags = ["AllDeployments"];
