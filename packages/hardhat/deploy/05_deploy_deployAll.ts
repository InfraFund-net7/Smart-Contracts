import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers, getNamedAccounts } = hre;
  const { deploy } = deployments;

  // ------------------------
  // Variables for easy adjustment
  // ------------------------

  // Minting amounts
  const securityTokenMintAmount = ethers.parseEther("1000000");
  const utilityTokenMintAmount = ethers.parseEther("1000000");

  // Milestones
  const milestoneAmounts = [
    ethers.parseEther("25000"), // Example milestone amounts in ethers
    ethers.parseEther("25000"),
    ethers.parseEther("25000"),
    ethers.parseEther("25000"),
  ];

  // Target amount for funding
  const targetAmount = ethers.parseEther("100000");

  // Investment period (30 days from now)
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const investmentPeriod = currentTime + 60; //2592000; // 30 days in seconds

  // ------------------------
  // Get named accounts
  // ------------------------

  const { adminSigner, auditorSigner, clientSigner, generalContractorSigner } = await getNamedAccounts();

  // ------------------------
  // Deploy SecurityToken
  // ------------------------

  console.log("🚀 Deploying SecurityToken...");
  const SecurityToken = await deploy("SecurityToken", {
    from: clientSigner,
    args: [securityTokenMintAmount],
    log: true,
  });
  console.log(`🔑 SecurityToken deployed at: ${SecurityToken.address}`);
  const clientBalance = await ethers.provider.getBalance(clientSigner);
  console.log(`Client's SecurityToken balance: ${ethers.formatUnits(clientBalance, 18)} tokens`);

  if (clientBalance > 0) {
    console.log("✅ Minting was successful, balance is greater than zero.");
  } else {
    console.log("❌ Minting failed, balance is 0.");
  }
  console.log(`👤 Deployed by: ${clientSigner}`);
  console.log("----------------------------------------------------------------------------");

  // ------------------------
  // Deploy UtilityToken
  // ------------------------

  console.log("🚀 Deploying UtilityToken...");
  const UtilityToken = await deploy("UtilityToken", {
    from: adminSigner,
    args: [utilityTokenMintAmount],
    log: true,
  });
  console.log(`💸 UtilityToken deployed at: ${UtilityToken.address}`);
  const adminBalance = await ethers.provider.getBalance(adminSigner);
  console.log(`Admin's UtilityToken balance: ${ethers.formatUnits(adminBalance, 18)} tokens`);

  if (adminBalance > 0) {
    console.log("✅ Minting was successful, balance is greater than zero.");
  } else {
    console.log("❌ Minting failed, balance is 0.");
  }
  console.log(`👤 Deployed by: ${adminSigner}`);
  console.log("----------------------------------------------------------------------------");

  // ------------------------
  // Deploy EnergyToken
  // ------------------------

  console.log("🚀 Deploying EnergyToken...");
  const EnergyToken = await deploy("EnergyToken", {
    from: adminSigner,
    args: ["InfraPower", "IFPR"],
    log: true,
  });
  console.log(`🔋 EnergyToken deployed at: ${EnergyToken.address}`);
  console.log(`📛 Token Name: InfraPower`);
  console.log(`🔑 Token Symbol: IFPR`);
  console.log(`👤 Deployed by: ${adminSigner}`);
  console.log("⚡️ Energy tokens will be minted upon client pledge of SecurityTokens.");
  console.log("----------------------------------------------------------------------------");

  // ------------------------
  // Deploy CrowdFunding
  // ------------------------

  console.log("🚀 Deploying CrowdFunding...");
  const CrowdFunding = await deploy("CrowdFunding", {
    from: adminSigner,
    args: [
      SecurityToken.address,
      UtilityToken.address,
      EnergyToken.address,
      investmentPeriod,
      targetAmount,
      auditorSigner,
      generalContractorSigner,
      clientSigner,
      milestoneAmounts,
    ],
    log: true,
  });
  console.log(`🌍 CrowdFunding contract deployed at: ${CrowdFunding.address}`);
  console.log(`📛 SecurityToken: ${SecurityToken.address}`);
  console.log(`💸 UtilityToken: ${UtilityToken.address}`);
  console.log(`🔋 EnergyToken: ${EnergyToken.address}`);
  console.log(`⏰ Investment Period: ${new Date(investmentPeriod * 1000).toISOString()}`);
  console.log(`🎯 Target Amount: ${ethers.formatUnits(targetAmount, 18)} tokens`);
  console.log(`📊 Milestone Amounts: ${milestoneAmounts.map(amount => ethers.formatUnits(amount, 18))}`);
  console.log(`👤 Deployed by: ${adminSigner}`);
  console.log(`🕵️‍♂️ - Auditor: ${auditorSigner}`);
  console.log(`🏗️ - General Contractor: ${generalContractorSigner}`);
  console.log(`👤 - Client: ${clientSigner}`);
  console.log("----------------------------------------------------------------------------");

  // Additional logs to clarify deployment
  console.log("CrowdFunding contract deployment completed successfully. Ready for use.");
};

export default deployAll;

deployAll.tags = ["AllDeployments"];

// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";

// const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

//     const [adminSigner, auditorSigner, clientSigner, generalContractorSigner] = await hre.ethers.getSigners();

//   // 1. Deploy SecurityToken (using getFactoryToken method)
//   console.log("🚀 Deploying SecurityToken...");
//   const SecurityTokenFactory = await hre.ethers.getContractFactory("SecurityToken", clientSigner);
//   const securityToken = await SecurityTokenFactory.deploy(hre.ethers.parseEther("1000000"));
//   const clientBalance = await securityToken.balanceOf(clientSigner.address);
//   console.log(`🔑 SecurityToken deployed at: ${securityToken.target}`);
//   console.log(`👤 Deployed by: ${clientSigner.address}`);
//   if (clientBalance > 0) {
//     console.log("✅ Minting was successful, balance is greater than zero.");
//   } else {
//     console.log("❌ Minting failed, balance is 0.");
//   }
//   console.log(`Client's SecurityToken balance after deployment: ${hre.ethers.formatUnits(clientBalance, 18)} tokens`);
//   console.log("----------------------------------------------------------------------------");

//   // 2. Deploy UtilityToken (using getFactoryToken method)
//   console.log("🚀 Deploying UtilityToken...");
//   const UtilityTokenFactory = await hre.ethers.getContractFactory("SecurityToken", auditorSigner);
//   const utilityToken = await UtilityTokenFactory.deploy(hre.ethers.parseEther("1000000"));
//   const auditorBalance = await utilityToken.balanceOf(auditorSigner.address);
//   console.log(`💸 UtilityToken deployed at: ${utilityToken.target}`);
//   console.log(`👤 Deployed by: ${auditorSigner.address}`);
//   console.log(`Auditor's UtilityToken balance after deployment: ${hre.ethers.formatUnits(auditorBalance, 18)} tokens`);
//   if (auditorBalance > 0) {
//     console.log("✅ Minting was successful, balance is greater than zero.");
//   } else {
//     console.log("❌ Minting failed, balance is 0.");
//   }
//   console.log("----------------------------------------------------------------------------");

//   // 3. Deploy EnergyToken using getFactoryToken method
//   console.log("🚀 Deploying EnergyToken...");
//   const EnergyTokenFactory = await hre.ethers.getContractFactory("EnergyToken", adminSigner);
//   const energyToken = await EnergyTokenFactory.deploy("InfraPower", "IFPR");
//   console.log(`🔋 EnergyToken deployed at: ${energyToken.target}`);
//   console.log(`📛 Token Name: InfraPower`);
//   console.log(`🔑 Token Symbol: IFPR`);
//   console.log(`👤 Deployed by: ${adminSigner.address}`);
//   console.log("⚡️ Energy tokens will be minted upon client pledge of SecurityTokens.");

//   console.log("----------------------------------------------------------------------------");

//   // 4. Define the missing variables
//   const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
//   const investmentPeriod = currentTime + 2592000; // 30 days (in seconds)
//   const targetAmount = hre.ethers.parseEther("100000"); // Example target amount in ethers
//   const milestoneAmounts = [
//     hre.ethers.parseEther("25000"), // Example milestone amounts in ethers
//     hre.ethers.parseEther("25000"),
//     hre.ethers.parseEther("25000"),
//     hre.ethers.parseEther("25000"),
//   ];

//   // 5. Deploy CrowdFunding using getFactoryToken method
//   console.log("🚀 Deploying CrowdFunding...");
//   const CrowdFundingFactory = await hre.ethers.getContractFactory("CrowdFunding", adminSigner);
//   const crowdFunding = await CrowdFundingFactory.deploy(
//     securityToken.target,
//     utilityToken.target,
//     energyToken.target,
//     investmentPeriod,
//     targetAmount,
//     auditorSigner.address,
//     generalContractorSigner.address,
//     clientSigner.address,
//     milestoneAmounts,
//   );
//   console.log(`🌍 CrowdFunding contract deployed at: ${crowdFunding.target}`);
//   console.log(`📛 SecurityToken: ${securityToken.target}`);
//   console.log(`💸 UtilityToken: ${utilityToken.target}`);
//   console.log(`🔋 EnergyToken: ${energyToken.target}`);
//   console.log(`⏰ Investment Period: ${new Date(investmentPeriod * 1000).toISOString()}`);
//   console.log(`🎯 Target Amount: ${hre.ethers.formatUnits(targetAmount, 18)} tokens`);
//   console.log(`📊 Milestone Amounts: ${milestoneAmounts.map(amount => hre.ethers.formatUnits(amount, 18))}`);
//   console.log(`👤 Deployed by Admin: ${adminSigner.address}`);
//   console.log(`🕵️‍♂️ - Auditor: ${auditorSigner.address}`);
//   console.log(`🏗️ - General Contractor: ${generalContractorSigner.address}`);
//   console.log(`👤 - Client: ${clientSigner.address}`);

//   // Additional logs to clarify deployment

//   // Final confirmation of successful deployment
//   console.log("CrowdFunding contract deployment completed successfully. Ready for use.");
//   console.log("----------------------------------------------------------------------------");
// };

// export default deployAll;
// deployAll.tags = ["AllDeployments"];
