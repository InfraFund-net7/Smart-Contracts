// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { Contract } from "ethers";

// /**
//  * Deploys a contract named "SecurityToken" using the deployer account and
//  * constructor arguments set to the deployer address.
//  *
//  * @param hre HardhatRuntimeEnvironment object.
//  */
// const deploySecurityToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   // Use ethers.utils.parseUnits to convert to the appropriate token unit
//   const initialSupply = hre.ethers.parseUnits("1000000", 18); // 1 million tokens, assuming 18 decimals

//   // Deploy the SecurityToken contract
//   await deploy("SecurityToken", {
//     from: deployer,
//     args: [initialSupply], // Pass the initialSupply as constructor argument
//     log: true,
//     autoMine: true,
//   });

//   // Get the deployed contract to interact with it after deploying.
//   const securityToken = await hre.ethers.getContract<Contract>("SecurityToken", deployer);
//   const deployedAddress = securityToken.target;
//   console.log("SecurityToken deployed at:", deployedAddress);

//   const balance = await securityToken.balanceOf(deployedAddress);
//   const balanceDe = await securityToken.balanceOf(deployer);

//   console.log("balance is:", balance);
//   console.log("balanceOfDeployer is:", balanceDe);
//   console.log("deployer is:", deployer);
// };

// export default deploySecurityToken;

// // Tags are useful if you have multiple deploy files and only want to run one of them.
// // e.g. yarn deploy --tags SecurityToken
// deploySecurityToken.tags = ["SecurityToken"];
