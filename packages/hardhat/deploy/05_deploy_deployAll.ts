import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the CrowdFunding contract and all required token contracts
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployCrowdFunding: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;

  // Get named accounts from hardhat.config.ts
  const { deployer, auditor, generalContractor, client, investor1, investor2, investor3 } = await getNamedAccounts();

  console.log("Deploying contracts with the account:", deployer);

  // Set up investment period (7 days from now)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const investmentPeriod = currentTimestamp + 7 * 24 * 60 * 60; // 7 days

  // Set target amount
  const targetAmount = ethers.parseEther("1000");

  // Set milestone amounts (should add up to target amount)
  const milestoneAmounts = [ethers.parseEther("300"), ethers.parseEther("400"), ethers.parseEther("300")];

  // Set claim period (30 days)
  const claimPeriod = 30 * 24 * 60 * 60;

  // Deploy Security Token
  const securityTokenDeployment = await deploy("SecurityToken", {
    from: deployer,
    args: ["Security Token", "STKN"],
    log: true,
    autoMine: true,
  });
  console.log("SecurityToken deployed to:", securityTokenDeployment.address);

  // Deploy Mock USDC
  const mockUSDCDeployment = await deploy("MockUSDC", {
    from: deployer,
    args: ["Mock USDC", "MUSDC"],
    log: true,
    autoMine: true,
  });
  console.log("MockUSDC deployed to:", mockUSDCDeployment.address);

  // Deploy Energy Token
  const energyTokenDeployment = await deploy("EnergyToken", {
    from: deployer,
    args: ["Energy Token", "ETKN"],
    log: true,
    autoMine: true,
  });
  console.log("EnergyToken deployed to:", energyTokenDeployment.address);

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

  // Get instances of deployed contracts for post-deployment configuration
  const securityToken = await ethers.getContractAt("SecurityToken", securityTokenDeployment.address);
  const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCDeployment.address);
  const energyToken = await ethers.getContractAt("EnergyToken", energyTokenDeployment.address);
  const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingDeployment.address);

  // Initialize the crowdfunding contract
  console.log("Initializing CrowdFunding contract...");
  await crowdFunding.initialize(investmentPeriod, targetAmount, milestoneAmounts);
  console.log("CrowdFunding contract initialized");

  // Grant minter role to CrowdFunding contract to mint energy tokens
  const MINTER_ROLE = await energyToken.MINTER_ROLE();
  await energyToken.grantRole(MINTER_ROLE, crowdFundingDeployment.address);
  console.log("Granted MINTER_ROLE to CrowdFunding contract");

  // Set energy provider (using auditor as energy provider for simplicity)
  await crowdFunding.setEnergyProvider(auditor);
  console.log("Energy provider set to:", auditor);

  // Mint some tokens to client for pledging
  await securityToken.mint(client, targetAmount);
  console.log("Minted security tokens to client:", ethers.formatEther(targetAmount));

  // Mint some mock USDC to investors for testing
  const investmentAmount = ethers.parseEther("500");
  await mockUSDC.mint(investor1, investmentAmount);
  await mockUSDC.mint(investor2, investmentAmount);
  await mockUSDC.mint(investor3, investmentAmount);
  console.log("Minted mock USDC to investors for testing:", ethers.formatEther(investmentAmount));

  console.log("Deployment and initial setup completed!");

  // Print contract addresses for easy reference
  console.log("\nDeployed contract addresses:");
  console.log("----------------------------");
  console.log("SecurityToken:", securityTokenDeployment.address);
  console.log("MockUSDC:", mockUSDCDeployment.address);
  console.log("EnergyToken:", energyTokenDeployment.address);
  console.log("CrowdFunding:", crowdFundingDeployment.address);
};

export default deployCrowdFunding;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags CrowdFunding
deployCrowdFunding.tags = ["CrowdFundingAndTokens"];
