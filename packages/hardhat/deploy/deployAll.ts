import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  //const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const clientAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const auditorAddress = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788";

  // 1. Deploy SecurityToken
  console.log("🚀 Deploying SecurityToken...");
  const securityTokenDeployment = await deploy("SecurityToken", {
    from: clientAddress, // Deploy from the specified address
    args: [hre.ethers.parseUnits("1000000", 18)], // Initial supply of 1 million tokens
    log: true,
    autoMine: true,
  });

  await hre.ethers.getContract<Contract>("SecurityToken", clientAddress);
  console.log(`🔑 SecurityToken deployed at: ${securityTokenDeployment.address}`);
  console.log(`👤 Deployed by: ${clientAddress}`);
  console.log("----------------------------------------------------------------------------"); // Separator for easy readability

  // 2. Deploy UtilityToken
  console.log("🚀 Deploying UtilityToken...");
  const utilityTokenDeployment = await deploy("UtilityToken", {
    from: auditorAddress, // Gonna be USDC later
    args: [hre.ethers.parseUnits("1000000", 18)], // Initial supply of 1 million tokens
    log: true,
    autoMine: true,
  });

  //await hre.ethers.getContract<Contract>("UtilityToken", auditorAddress);
  console.log(`💸 UtilityToken deployed at: ${utilityTokenDeployment.address}`);
  console.log(`👤 Deployed by: ${auditorAddress}`);
  console.log("----------------------------------------------------------------------------"); // Separator for easy readability

  // 3. Deploy EnergyToken (without CrowdFunding address)
  console.log("🚀 Deploying EnergyToken...");
  const energyTokenDeployment = await deploy("EnergyToken", {
    from: auditorAddress, // Set to a specific address
    args: ["EnergyToken", "ENG"], // Name and symbol for EnergyToken
    log: true,
    autoMine: true,
  });

  const energyToken = await hre.ethers.getContract<Contract>("EnergyToken", auditorAddress);
  console.log(`⚡ EnergyToken deployed at: ${energyTokenDeployment.address}`);
  console.log(`👤 Deployed by: ${auditorAddress}`);
  console.log("----------------------------------------------------------------------------"); // Separator for easy readability

  // 4. Deploy CrowdFunding
  console.log("🚀 Deploying CrowdFunding...");
  const investmentPeriod = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days from now
  const targetAmount = hre.ethers.parseUnits("1000", 18); // Target amount for crowdfunding
  const generalContractorAddress = "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a"; // General contractor address
  const milestoneAmounts = [hre.ethers.parseUnits("500", 18), hre.ethers.parseUnits("500", 18)];

  const crowdFundingDeployment = await deploy("CrowdFunding", {
    from: auditorAddress,
    args: [
      securityTokenDeployment.address, // SecurityToken address
      utilityTokenDeployment.address, // UtilityToken address
      energyTokenDeployment.address, // EnergyToken address
      investmentPeriod,
      targetAmount,
      auditorAddress,
      generalContractorAddress,
      clientAddress,
      milestoneAmounts,
    ],
    log: true,
    autoMine: true,
  });

  //await hre.ethers.getContract<Contract>("CrowdFunding", deployer);
  console.log(`🏗️ CrowdFunding deployed at: ${crowdFundingDeployment.address}`);
  console.log(`👤 Deployed by: ${auditorAddress}`);
  console.log("----------------------------------------------------------------------------"); // Separator for easy readability

  // 5. Set CrowdFunding contract in EnergyToken
  console.log("🔗 Linking CrowdFunding to EnergyToken...");
  const tx = await energyToken.setCrowdFundingContract(crowdFundingDeployment.address);
  await tx.wait();
  console.log(`💥 EnergyToken linked to CrowdFunding contract at: ${crowdFundingDeployment.address}`);
  console.log("----------------------------------------------------------------------------"); // Separator for easy readability
};

export default deployAll;
deployAll.tags = ["AllDeployments"];
