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
      investmentPeriod, // Investment period
      targetAmount, // Target amount
      auditor, // Auditor address
      generalContractor, // General contractor address
      client, // Client address
      milestoneAmounts, // Milestone amounts
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
//deployCrowdFunding.tags = ["CrowdFunding"];

deployCrowdFunding.tags = ["CrowdFundingAndTokens"];

// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";

// const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployments, ethers, getNamedAccounts } = hre;
//   const { deploy } = deployments;

//   // ------------------------
//   // Variables for easy adjustment
//   // ------------------------

//   // Minting amounts
//   const securityTokenMintAmount = ethers.parseEther("1000000");
//   const mockUSDCMintAmount = ethers.parseEther("1000000");

//   // Milestones
//   const milestoneAmounts = [
//     ethers.parseEther("25000"),
//     ethers.parseEther("25000"),
//     ethers.parseEther("25000"),
//     ethers.parseEther("25000"),
//   ];

//   // Target amount for funding
//   const targetAmount = ethers.parseEther("100000");

//   // Investment period (30 days from now)
//   const currentTime = Math.floor(Date.now() / 1000);
//   const investmentPeriod = currentTime + 60; // Adjust as needed

//   // Claim Period and Max Voting Period (new parameters)
//   const CLAIM_PERIOD = 60 * 60 * 24 * 7; // Example: 7 days
//   const MAX_VOTING_PERIOD = 60 * 60 * 24 * 7; // Example: 7 days

//   // ------------------------
//   // Get named accounts and convert to signers
//   // ------------------------

//   const { adminSigner, auditorSigner, clientSigner, generalContractorSigner } = await getNamedAccounts();

//   const admin = await ethers.getSigner(adminSigner);
//   const auditor = await ethers.getSigner(auditorSigner);
//   const client = await ethers.getSigner(clientSigner);
//   const generalContractor = await ethers.getSigner(generalContractorSigner);

//   // ------------------------
//   // Deploy SecurityToken
//   // ------------------------

//   console.log("🚀 Deploying SecurityToken...");
//   const SecurityToken = await deploy("SecurityToken", {
//     from: client.address,
//     args: [securityTokenMintAmount],
//     log: true,
//   });

//   console.log(`🔑 SecurityToken deployed at: ${SecurityToken.address}`);
//   const clientBalance = await ethers.provider.getBalance(client.address);
//   console.log(`Client's SecurityToken balance: ${ethers.formatUnits(clientBalance, 18)} tokens`);

//   if (clientBalance > 0) {
//     console.log("✅ Minting was successful, balance is greater than zero.");
//   } else {
//     console.log("❌ Minting failed, balance is 0.");
//   }
//   console.log(`👤 Deployed by: ${client.address}`);
//   console.log("----------------------------------------------------------------------------");

//   // ------------------------
//   // Deploy MockUSDC
//   // ------------------------

//   console.log("🚀 Deploying MockUSDC...");
//   const MockUSDC = await deploy("MockUSDC", {
//     from: admin.address,
//     args: [mockUSDCMintAmount],
//     log: true,
//   });

//   console.log(`💸 MockUSDC deployed at: ${MockUSDC.address}`);
//   const adminBalance = await ethers.provider.getBalance(admin.address);
//   console.log(`Admin's MockUSDC balance: ${ethers.formatUnits(adminBalance, 18)} tokens`);

//   if (adminBalance > 0) {
//     console.log("✅ Minting was successful, balance is greater than zero.");
//   } else {
//     console.log("❌ Minting failed, balance is 0.");
//   }
//   console.log(`👤 Deployed by: ${admin.address}`);
//   console.log("----------------------------------------------------------------------------");

//   // ------------------------
//   // Deploy EnergyToken
//   // ------------------------

//   console.log("🚀 Deploying EnergyToken...");
//   const EnergyToken = await deploy("EnergyToken", {
//     from: admin.address,
//     args: ["InfraPower", "IFPR"],
//     log: true,
//   });

//   console.log(`🔋 EnergyToken deployed at: ${EnergyToken.address}`);
//   console.log(`📛 Token Name: InfraPower`);
//   console.log(`🔑 Token Symbol: IFPR`);
//   console.log(`👤 Deployed by: ${admin.address}`);
//   console.log("⚡️ Energy tokens will be minted upon client pledge of SecurityTokens.");
//   console.log("----------------------------------------------------------------------------");

//   // ------------------------
//   // Deploy CrowdFunding
//   // ------------------------

//   console.log("🚀 Deploying CrowdFunding...");
//   const CrowdFundingDeployment = await deploy("CrowdFunding", {
//     from: admin.address,
//     args: [], // No constructor arguments
//     log: true,
//   });

//   console.log(`🏗 CrowdFunding deployed at: ${CrowdFundingDeployment.address}`);

//   // Get contract instance
//   const CrowdFunding = await ethers.getContractAt("CrowdFunding", CrowdFundingDeployment.address, admin);

//   // Initialize the contract
//   console.log("⚙️ Initializing CrowdFunding...");
//   const tx = await CrowdFunding.initialize(
//     SecurityToken.address,
//     MockUSDC.address,
//     EnergyToken.address,
//     investmentPeriod,
//     targetAmount,
//     auditor.address,
//     generalContractor.address,
//     client.address,
//     milestoneAmounts,
//     CLAIM_PERIOD,        // New parameter
//     MAX_VOTING_PERIOD    // New parameter
//   );
//   await tx.wait();

//   console.log("✅ CrowdFunding initialized successfully!");
//   console.log("----------------------------------------------------------------------------");

//   // Additional logs to clarify deployment
//   console.log("CrowdFunding contract deployment completed successfully. Ready for use.");
// };

// export default deployAll;
// deployAll.tags = ["AllDeployments"];
