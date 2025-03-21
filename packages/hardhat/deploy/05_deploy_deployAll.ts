import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  //  const { deploy } = hre.deployments;

  const [clientSigner, auditorSigner, adminSigner, generalContractorSigner] = await hre.ethers.getSigners();

  // 1. Deploy SecurityToken (using getFactoryToken method)
  console.log("🚀 Deploying SecurityToken...");
  const SecurityTokenFactory = await hre.ethers.getContractFactory("SecurityToken", clientSigner);
  const securityToken = await SecurityTokenFactory.deploy(hre.ethers.parseEther("1000000"));
  const clientBalance = await securityToken.balanceOf(clientSigner.address);
  console.log(`🔑 SecurityToken deployed at: ${securityToken.target}`);
  console.log(`👤 Deployed by: ${clientSigner.address}`);
  if (clientBalance > 0) {
    console.log("✅ Minting was successful, balance is greater than zero.");
  } else {
    console.log("❌ Minting failed, balance is 0.");
  }
  console.log(`Client's SecurityToken balance after deployment: ${hre.ethers.formatUnits(clientBalance, 18)} tokens`);
  console.log("----------------------------------------------------------------------------");

  // 2. Deploy UtilityToken (using getFactoryToken method)
  console.log("🚀 Deploying UtilityToken...");
  const UtilityTokenFactory = await hre.ethers.getContractFactory("SecurityToken", auditorSigner);
  const utilityToken = await UtilityTokenFactory.deploy(hre.ethers.parseEther("1000000"));
  const auditorBalance = await utilityToken.balanceOf(auditorSigner.address);
  console.log(`💸 UtilityToken deployed at: ${utilityToken.target}`);
  console.log(`👤 Deployed by: ${auditorSigner.address}`);
  console.log(`Auditor's UtilityToken balance after deployment: ${hre.ethers.formatUnits(auditorBalance, 18)} tokens`);
  if (auditorBalance > 0) {
    console.log("✅ Minting was successful, balance is greater than zero.");
  } else {
    console.log("❌ Minting failed, balance is 0.");
  }
  console.log("----------------------------------------------------------------------------");

  // 3. Deploy EnergyToken using getFactoryToken method
  console.log("🚀 Deploying EnergyToken...");
  const EnergyTokenFactory = await hre.ethers.getContractFactory("EnergyToken", adminSigner);
  const energyToken = await EnergyTokenFactory.deploy("InfraPower", "IFPR");
  console.log(`🔋 EnergyToken deployed at: ${energyToken.target}`);
  console.log(`📛 Token Name: InfraPower`);
  console.log(`🔑 Token Symbol: IFPR`);
  console.log(`👤 Deployed by: ${adminSigner.address}`);
  console.log("⚡️ Energy tokens will be minted upon client pledge of SecurityTokens.");

  console.log("----------------------------------------------------------------------------");

  // 4. Define the missing variables
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const investmentPeriod = currentTime + 2592000; // 30 days (in seconds)
  const targetAmount = hre.ethers.parseEther("100000"); // Example target amount in ethers
  const milestoneAmounts = [
    hre.ethers.parseEther("25000"), // Example milestone amounts in ethers
    hre.ethers.parseEther("25000"),
    hre.ethers.parseEther("25000"),
    hre.ethers.parseEther("25000"),
  ];

  // 5. Deploy CrowdFunding using getFactoryToken method
  console.log("🚀 Deploying CrowdFunding...");
  const CrowdFundingFactory = await hre.ethers.getContractFactory("CrowdFunding", adminSigner);
  const crowdFunding = await CrowdFundingFactory.deploy(
    securityToken.target,
    utilityToken.target,
    energyToken.target,
    investmentPeriod,
    targetAmount,
    auditorSigner.address,
    generalContractorSigner.address,
    clientSigner.address,
    milestoneAmounts,
  );
  console.log(`🌍 CrowdFunding contract deployed at: ${crowdFunding.target}`);
  console.log(`📛 SecurityToken: ${securityToken.target}`);
  console.log(`💸 UtilityToken: ${utilityToken.target}`);
  console.log(`🔋 EnergyToken: ${energyToken.target}`);
  console.log(`⏰ Investment Period: ${new Date(investmentPeriod * 1000).toISOString()}`);
  console.log(`🎯 Target Amount: ${hre.ethers.formatUnits(targetAmount, 18)} tokens`);
  console.log(`📊 Milestone Amounts: ${milestoneAmounts.map(amount => hre.ethers.formatUnits(amount, 18))}`);
  console.log(`👤 Deployed by Admin: ${adminSigner.address}`);
  console.log(`🕵️‍♂️ - Auditor: ${auditorSigner.address}`);
  console.log(`🏗️ - General Contractor: ${generalContractorSigner.address}`);
  console.log(`👤 - Client: ${clientSigner.address}`);

  // Additional logs to clarify deployment

  // Final confirmation of successful deployment
  console.log("CrowdFunding contract deployment completed successfully. Ready for use.");
  console.log("----------------------------------------------------------------------------");
};

export default deployAll;

// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { EnergyToken__factory } from "../typechain-types";

// const deployAll: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deploy } = hre.deployments;

//   const [adminSigner, clientSigner, auditorSigner, generalContractorSigner] = await hre.ethers.getSigners();

//     // 1. Deploy SecurityToken
//   console.log("🚀 Deploying SecurityToken...");

//   const SecurityToken = await hre.ethers.getContractFactory("SecurityToken", clientSigner);
//   const securityToken = await SecurityToken.deploy(hre.ethers.parseEther("1000000"));
//   const clientBalance = await securityToken.balanceOf(clientSigner.address);

//   console.log(`🔑 SecurityToken deployed at: ${securityToken.target}`);
//   console.log(`👤 Deployed by: ${clientSigner.address}`);
//   console.log(`Client's SecurityToken balance after deployment: ${hre.ethers.formatUnits(clientBalance, 18)} tokens`);

//   console.log("----------------------------------------------------------------------------");

//   // 2. Deploy UtilityToken
//   // Step 1: Deploy the UtilityToken contract with 1M tokens
//   console.log("🚀 Deploying UtilityToken...");

//   const UtilityToken = await hre.ethers.getContractFactory("SecurityToken", auditorSigner);
//   const utilityToken = await UtilityToken.deploy(hre.ethers.parseEther("1000000"));

//   // Check the auditor's balance of UtilityTokens after deployment
//   const auditorBalance = await utilityToken.balanceOf(auditorSigner.address);

//   // Log the deployment details and the balance
//   console.log(`💸 UtilityToken deployed at: ${utilityToken.target}`);
//   console.log(`👤 Deployed by: ${auditorSigner.address}`);
//   console.log(`Auditor's UtilityToken balance after deployment: ${hre.ethers.formatUnits(auditorBalance, 18)} tokens`);

//   // Check if the balance is greater than zero
//   if (auditorBalance > 0) {
//     console.log("✅ Minting was successful, balance is greater than zero.");
//   } else {
//     console.log("❌ Minting failed, balance is 0.");
//   }

//   console.log("----------------------------------------------------------------------------");

//   // 3. Deploy EnergyToken (without CrowdFunding address)
//   console.log("🚀 Deploying EnergyToken...");

//   const EnergyToken = await hre.ethers.getContractFactory("EnergyToken", adminSigner);
//   const enegryToken = await EnergyToken.deploy("InfraPower","IFPR");
//   const energyBalance = energyToken.balanceOf(adminSigner.address)

//   // const energyTokenDeployment = await deploy("EnergyToken", {
//   //   from: auditorSigner.address, // Use the same deployer for all contracts
//   //   args: ["EnergyToken", "ENG"],
//   //   log: true,
//   //   autoMine: true,
//   // });

//   console.log(`⚡ EnergyToken deployed at: ${energyToken.target}`);
//   console.log(`👤 Deployed by: ${auditorSigner.address}`);
//   console.log("----------------------------------------------------------------------------");

//   // 4. Deploy CrowdFunding
//   console.log("🚀 Deploying CrowdFunding...");
//   const currentTimestamp = Math.floor(Date.now() / 1000);
//   const investmentPeriod = currentTimestamp + 60 * 60 * 24 * 30; // 30 days from now
//   const targetAmount = hre.ethers.parseEther("1000");
//   const milestoneAmounts = [hre.ethers.parseEther("500"), hre.ethers.parseEther("500")];

//   const crowdFundingDeployment = await deploy("CrowdFunding", {
//     from: auditorSigner.address, // Use the same deployer for all contracts
//     args: [
//       securityTokenDeployment.address,
//       utilityTokenDeployment.address,
//       energyTokenDeployment.address,
//       investmentPeriod,
//       targetAmount,
//       auditorSigner.address,
//       generalContractorSigner.address,
//       clientSigner.address,
//       milestoneAmounts,
//     ],
//     log: true,
//     autoMine: true,
//   });

//   await hre.ethers.getContractAt("CrowdFunding", crowdFundingDeployment.address, auditorSigner);
//   console.log(`🏗️ CrowdFunding deployed at: ${crowdFundingDeployment.address}`);
//   console.log(`👤 Deployed by: ${auditorSigner.address}`);
//   console.log("----------------------------------------------------------------------------");
// };
// console.log("----------------------------------------------------------------------------");

// export default deployAll;
deployAll.tags = ["AllDeployments"];
