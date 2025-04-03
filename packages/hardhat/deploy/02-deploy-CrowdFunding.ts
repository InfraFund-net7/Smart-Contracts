import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the CrowdFunding contract and configures it with already deployed tokens
 * This script should be run after the token deployment script
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployCrowdFunding: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  // Get named accounts from hardhat.config.ts
  const { deployer, auditor, generalContractor, client } = await getNamedAccounts();

  console.log("Deploying CrowdFunding contract with the account:", deployer);
  console.log("Network:", hre.network.name);

  // Get previously deployed token addresses
  const securityTokenDeployment = await get("SecurityToken");
  const mockUSDCDeployment = await get("MockUSDC");
  const energyTokenDeployment = await get("EnergyToken");

  console.log("Using tokens:");
  console.log("SecurityToken:", securityTokenDeployment.address);
  console.log("MockUSDC:", mockUSDCDeployment.address);
  console.log("EnergyToken:", energyTokenDeployment.address);

  // Set claim period (30 days)
  const claimPeriod = 30 * 24 * 60 * 60;

  // Deploy CrowdFunding contract
  const crowdFundingDeployment = await deploy("CrowdFunding", {
    from: deployer,
    args: [
      securityTokenDeployment.address, // Security token address
      mockUSDCDeployment.address, // Mock USDC address
      energyTokenDeployment.address, // Energy token address
      auditor, // Auditor address
      generalContractor, // General contractor address
      client, // Client address
      claimPeriod, // Claim period
    ],
    log: true,
    autoMine: true,
  });
  console.log("CrowdFunding deployed to:", crowdFundingDeployment.address);

  // ---------------------- Initialization for Post-deployment Setup ----------------------

  // Get instances of deployed contracts for post-deployment configuration
  const energyToken = await hre.ethers.getContractAt("EnergyToken", energyTokenDeployment.address);
  const crowdFunding = await hre.ethers.getContractAt("CrowdFunding", crowdFundingDeployment.address);

  // Initialize the crowdfunding contract
  console.log("Initializing CrowdFunding contract...");
  // Uncomment the following lines once you have your investment period, target amount, and milestone amounts set
  // const investmentPeriod = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // Example: 7 days from now
  // const targetAmount = ethers.parseEther("1000");
  // const milestoneAmounts = [ethers.parseEther("300"), ethers.parseEther("400"), ethers.parseEther("300")];
  // await crowdFunding.initialize(investmentPeriod, targetAmount, milestoneAmounts);
  // console.log("CrowdFunding contract initialized");

  // Grant minter role to CrowdFunding contract to mint energy tokens
  const MINTER_ROLE = await energyToken.MINTER_ROLE();
  await energyToken.grantRole(MINTER_ROLE, crowdFundingDeployment.address);
  console.log("Granted MINTER_ROLE to CrowdFunding contract");

  // Set energy provider (using auditor as energy provider for simplicity)
  await crowdFunding.setEnergyProvider(auditor);
  console.log("Energy provider set to:", auditor);

  console.log("CrowdFunding deployment and initial setup completed!");
};

export default deployCrowdFunding;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags CrowdFunding
deployCrowdFunding.tags = ["CrowdFunding"];
deployCrowdFunding.dependencies = ["Tokens"]; // This ensures tokens are deployed first
