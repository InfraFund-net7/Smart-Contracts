// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { Contract } from "ethers";

// /**
//  * Deploys a contract named "UtilityToken" using the deployer account and
//  * constructor arguments set to the deployer address.
//  *
//  * @param hre HardhatRuntimeEnvironment object.
//  */
// const deployUtilityToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   // Use ethers.utils.parseUnits to convert to the appropriate token unit
//   const initialSupply = hre.ethers.parseUnits("1000000", 18); // 1 million tokens, assuming 18 decimals

//   // Deploy the UtilityToken contract
//   await deploy("UtilityToken", {
//     from: deployer,
//     args: [initialSupply], // Pass the initialSupply as constructor argument
//     log: true,
//     autoMine: true,
//   });

//   // Get the deployed contract to interact with it after deploying.
//   const UtilityToken = await hre.ethers.getContract<Contract>("UtilityToken", deployer);
//   const deployedAddress = UtilityToken.target;
//   console.log("UtilityToken deployed at:", deployedAddress);

//   const balance = await UtilityToken.balanceOf(deployedAddress);
//   const balanceDe = await UtilityToken.balanceOf(deployer);

//   console.log("balance is:", balance);
//   console.log("balanceOfDeployer is:", balanceDe);
//   console.log("deployer is:", deployer);
// };

// export default deployUtilityToken;

// // Tags are useful if you have multiple deploy files and only want to run one of them.
// // e.g. yarn deploy --tags UtilityToken
// deployUtilityToken.tags = ["UtilityToken"];
