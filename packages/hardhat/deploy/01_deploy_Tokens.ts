import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys all token contracts needed for the crowdfunding platform
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployTokens: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  // Get named accounts from hardhat.config.ts
  const { deployer, client } = await getNamedAccounts();

  console.log("Deploying token contracts with the account:", deployer);
  console.log("Network:", hre.network.name);

  // Deploy Security Token
  const securityTokenDeployment = await deploy("SecurityToken", {
    from: client,
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

  console.log("Token deployment and initial setup completed!");

  // Print contract addresses for easy reference
  console.log("\nDeployed token contract addresses:");
  console.log("----------------------------");
  console.log("SecurityToken:", securityTokenDeployment.address);
  console.log("MockUSDC:", mockUSDCDeployment.address);
  console.log("EnergyToken:", energyTokenDeployment.address);
};

export default deployTokens;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags Tokens
deployTokens.tags = ["Tokens"];
