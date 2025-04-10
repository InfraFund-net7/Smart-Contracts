import * as dotenv from "dotenv";
dotenv.config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";

// Use runtime decrypted keys if available, otherwise use encrypted keys
const deployerPrivateKey =
  process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
const auditorPrivateKey =
  process.env.__RUNTIME_AUDITOR_PRIVATE_KEY ||
  process.env.AUDITOR_PRIVATE_KEY ||
  process.env.AUDITOR_PRIVATE_KEY_ENCRYPTED;
const generalContractorPrivateKey =
  process.env.__RUNTIME_GENERAL_CONTRACTOR_PRIVATE_KEY ||
  process.env.GENERAL_CONTRACTOR_PRIVATE_KEY ||
  process.env.GENERAL_CONTRACTOR_PRIVATE_KEY_ENCRYPTED;
const clientPrivateKey =
  process.env.__RUNTIME_CLIENT_PRIVATE_KEY ||
  process.env.CLIENT_PRIVATE_KEY ||
  process.env.CLIENT_PRIVATE_KEY_ENCRYPTED;
const investor1PrivateKey =
  process.env.__RUNTIME_INVESTOR1_PRIVATE_KEY ||
  process.env.INVESTOR1_PRIVATE_KEY ||
  process.env.INVESTOR1_PRIVATE_KEY_ENCRYPTED;
const investor2PrivateKey =
  process.env.__RUNTIME_INVESTOR2_PRIVATE_KEY ||
  process.env.INVESTOR2_PRIVATE_KEY ||
  process.env.INVESTOR2_PRIVATE_KEY_ENCRYPTED;
const investor3PrivateKey =
  process.env.__RUNTIME_INVESTOR3_PRIVATE_KEY ||
  process.env.INVESTOR3_PRIVATE_KEY ||
  process.env.INVESTOR3_PRIVATE_KEY_ENCRYPTED;
const infraFundWalletPrivateKey =
  process.env.__RUNTIME_INFRAFUNDWALLET_PRIVATE_KEY ||
  process.env.INFRAFUNDWALLET_PRIVATE_KEY ||
  process.env.INFRAFUNDWALLET_PRIVATE_KEY_ENCRYPTED;

const providerApiKey = process.env.ALCHEMY_API_KEY || "your-api-key";
//const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "your-etherscan-api-key";

// Helper function to get account private keys
const getNetworkAccounts = (): string[] | undefined => {
  // For local networks, use default accounts
  if (process.env.HARDHAT_NETWORK === "localhost" || process.env.HARDHAT_NETWORK === "hardhat") {
    return undefined; // Use default hardhat accounts
  }

  // For testnets/mainnet, use the runtime or regular private keys
  const accounts = [
    deployerPrivateKey,
    auditorPrivateKey,
    generalContractorPrivateKey,
    clientPrivateKey,
    investor1PrivateKey,
    investor2PrivateKey,
    investor3PrivateKey,
    infraFundWalletPrivateKey,
  ];

  // Filter out undefined values and cast to string[]
  return accounts.filter((key): key is string => typeof key === "string");
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "localhost",

  // Named accounts for deployers
  namedAccounts: {
    deployer: {
      default: 0,
      sepolia: 0,
      optimismSepolia: 0,
    },
    auditor: {
      default: 1,
      sepolia: 1,
      optimismSepolia: 1,
    },
    generalContractor: {
      default: 2,
      sepolia: 2,
      optimismSepolia: 2,
    },
    client: {
      default: 3,
      sepolia: 3,
      optimismSepolia: 3,
    },
    investor1: {
      default: 4,
      sepolia: 4,
      optimismSepolia: 4,
    },
    investor2: {
      default: 5,
      sepolia: 5,
      optimismSepolia: 5,
    },
    investor3: {
      default: 6,
      sepolia: 6,
      optimismSepolia: 6,
    },
    infraFundWallet: {
      default: 7,
      sepolia: 7,
      optimismSepolia: 7,
    },
  },

  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
        enabled: process.env.MAINNET_FORKING_ENABLED === "true",
      },
      accounts: {
        count: 10,
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
      },
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
      accounts: getNetworkAccounts(),
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: getNetworkAccounts(),
    },
    optimismSepolia: {
      url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: getNetworkAccounts(),
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || process.env.ETHERSCAN_OPTIMISTIC_API_KEY, // General Etherscan API key for mainnet, etc.
    customChains: [
      {
        network: "optimismSepolia",
        chainId: 11155420, // Chain ID for Optimism Sepolia
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io/", // Browser URL for Optimism Sepolia
        },
      },
    ],
  },

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },

  mocha: {
    timeout: 20000,
  },
};

export default config;
