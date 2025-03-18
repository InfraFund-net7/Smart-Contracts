// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { Contract } from "ethers";

// /**
//  * Deploys the CrowdFunding contract with the specified constructor arguments.
//  *
//  * @param hre HardhatRuntimeEnvironment object.
//  */
// const deployCrowdFunding: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   // Replace with the specified Hardhat account addresses
//   const securityTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Account #8
//   const utilityTokenAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"; // Account #9
//   const energyTokenAddress = "0x31c91FD3540b5cE5780AFe47E442814e229BC019"; // Account #10
//   const investmentPeriod = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days from now
//   const targetAmount = hre.ethers.parseUnits("1000", 18); // Target amount (1 million tokens)
//   const auditorAddress = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788"; // Account #11
//   const generalContractorAddress = "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a"; // Account #12
//   const clientAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; //#0//"0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec"; // Account #13

//   // Example milestone amounts in utility tokens
//   const milestoneAmounts = [
//     hre.ethers.parseUnits("500", 18), // Milestone 1
//     hre.ethers.parseUnits("500", 18), // Milestone 2
//   ];

//   // Deploy the CrowdFunding contract
//   await deploy("CrowdFunding", {
//     from: deployer,
//     args: [
//       securityTokenAddress,
//       utilityTokenAddress,
//       energyTokenAddress,
//       investmentPeriod,
//       targetAmount,
//       auditorAddress,
//       generalContractorAddress,
//       clientAddress,
//       milestoneAmounts,
//     ],
//     log: true,
//     autoMine: true,
//   });

//   // Get the deployed contract instance
//   const CrowdFunding = await hre.ethers.getContract<Contract>("CrowdFunding", deployer);
//   console.log("CrowdFunding contract deployed at:", CrowdFunding.target);
// };

// export default deployCrowdFunding;

// // Tags are useful if you have multiple deploy files and only want to run one of them.
// // e.g. yarn deploy --tags CrowdFunding
// deployCrowdFunding.tags = ["CrowdFunding"];
