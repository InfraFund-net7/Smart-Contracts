// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { Contract } from "ethers";

// /**
//  * Deploys the EnergyToken contract.
//  *
//  * @param hre HardhatRuntimeEnvironment object.
//  */
// const deployEnergyToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   const tokenName = "EnergyToken";
//   const tokenSymbol = "ENG";
//   const crowdfundingContract = "0xF1478f211F027EBA42ca369ea976F1eB43C6bB53"; // Replace with actual crowdfunding contract address after deployment

//   // Deploy the EnergyToken contract
//   await deploy("EnergyToken", {
//     from: deployer,
//     args: [tokenName, tokenSymbol, crowdfundingContract], // Constructor arguments
//     log: true,
//     autoMine: true,
//   });

//   // Get the deployed contract instance
//   const energyToken = await hre.ethers.getContract<Contract>("EnergyToken", deployer);
//   const deployedAddress = energyToken.target;
//   console.log(`${tokenName} deployed at:`, deployedAddress);
// };

// export default deployEnergyToken;

// deployEnergyToken.tags = ["EnergyToken"];
