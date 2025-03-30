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
import { task } from "hardhat/config";
import generateTsAbis from "./scripts/generateTsAbis";
import CryptoJS from "crypto-js";

// Decrypt private key function with fallback to handle decryption errors
function getPrivateKey(encryptedKey: string | undefined, defaultKey: string): string {
  // If no encrypted key is provided, return the default
  if (!encryptedKey) {
    console.log("Using default private key");
    return defaultKey;
  }

  // Check if the key starts with 0x - if so, it's likely already a plaintext key
  if (encryptedKey.startsWith("0x")) {
    return encryptedKey;
  }

  // Try to decrypt the key
  try {
    const secret = process.env.PRIVATE_KEY_SECRET || "your_secret_key";
    const bytes = CryptoJS.AES.decrypt(encryptedKey, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    // If decryption resulted in an empty string or not a valid hex, use default
    if (!decrypted || !decrypted.startsWith("0x")) {
      console.log("Decryption resulted in invalid key, using default");
      return defaultKey;
    }

    return decrypted;
    /* eslint-disable */
  } catch (error) {
    /* eslint-enable */

    console.log("Error decrypting private key, using default instead");
    return defaultKey;
  }
}

// Default hardhat account private keys for development
const DEFAULT_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // deployer
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // auditor
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // generalContractor
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // client
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // investor1
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // investor2
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // investor3
];

// Get private keys with fallback
const deployerPrivateKey = getPrivateKey(process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED, DEFAULT_PRIVATE_KEYS[0]);
const auditorPrivateKey = getPrivateKey(process.env.AUDITOR_DEPLOYER_PRIVATE_KEY_ENCRYPTED, DEFAULT_PRIVATE_KEYS[1]);
const generalContractorPrivateKey = getPrivateKey(
  process.env.GENERAL_CONTRACTOR_PRIVATE_KEY_ENCRYPTED,
  DEFAULT_PRIVATE_KEYS[2],
);
const clientPrivateKey = getPrivateKey(process.env.CLIENT_PRIVATE_KEY_ENCRYPTED, DEFAULT_PRIVATE_KEYS[3]);
const investor1PrivateKey = getPrivateKey(process.env.INVESTOR1_PRIVATE_KEY_ENCRYPTED, DEFAULT_PRIVATE_KEYS[4]);
const investor2PrivateKey = getPrivateKey(process.env.INVESTOR2_PRIVATE_KEY_ENCRYPTED, DEFAULT_PRIVATE_KEYS[5]);
const investor3PrivateKey = getPrivateKey(process.env.INVESTOR3_PRIVATE_KEY_ENCRYPTED, DEFAULT_PRIVATE_KEYS[6]);

const providerApiKey = process.env.ALCHEMY_API_KEY || "your-api-key";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "your-etherscan-api-key";
const etherscanOptimisticApiKey = process.env.ETHERSCAN_OPTIMISTIC_API_KEY || "your-optimistic-etherscan-api-key";
const basescanApiKey = process.env.BASESCAN_API_KEY || "your-basescan-api-key";

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
      accounts: [deployerPrivateKey],
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [
        deployerPrivateKey,
        auditorPrivateKey,
        generalContractorPrivateKey,
        clientPrivateKey,
        investor1PrivateKey,
        investor2PrivateKey,
        investor3PrivateKey,
      ],
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    arbitrumSepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
      verify: {
        etherscan: {
          apiUrl: "https://api-optimistic.etherscan.io",
          apiKey: etherscanOptimisticApiKey,
        },
      },
    },
    optimismSepolia: {
      url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [
        deployerPrivateKey,
        auditorPrivateKey,
        generalContractorPrivateKey,
        clientPrivateKey,
        investor1PrivateKey,
        investor2PrivateKey,
        investor3PrivateKey,
      ],
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia-optimistic.etherscan.io",
          apiKey: etherscanOptimisticApiKey,
        },
      },
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonMumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonZkEvm: {
      url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonZkEvmTestnet: {
      url: `https://polygonzkevm-testnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    gnosis: {
      url: "https://rpc.gnosischain.com",
      accounts: [deployerPrivateKey],
    },
    chiado: {
      url: "https://rpc.chiadochain.net",
      accounts: [deployerPrivateKey],
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: [deployerPrivateKey],
      verify: {
        etherscan: {
          apiUrl: "https://api.basescan.org",
          apiKey: basescanApiKey,
        },
      },
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [deployerPrivateKey],
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.basescan.org",
          apiKey: basescanApiKey,
        },
      },
    },
    scrollSepolia: {
      url: "https://sepolia-rpc.scroll.io",
      accounts: [deployerPrivateKey],
    },
    scroll: {
      url: "https://rpc.scroll.io",
      accounts: [deployerPrivateKey],
    },
    pgn: {
      url: "https://rpc.publicgoods.network",
      accounts: [deployerPrivateKey],
    },
    pgnTestnet: {
      url: "https://sepolia.publicgoods.network",
      accounts: [deployerPrivateKey],
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: [deployerPrivateKey],
    },
    celoAlfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [deployerPrivateKey],
    },
  },

  // configuration for hardhat-verify plugin
  etherscan: {
    apiKey: `${etherscanApiKey}`,
  },
  // configuration for etherscan-verify from hardhat-deploy plugin
  verify: {
    etherscan: {
      apiKey: `${etherscanApiKey}`,
    },
  },
  sourcify: {
    enabled: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
};

// Extend the deploy task
task("deploy").setAction(async (args, hre, runSuper) => {
  // Run the original deploy task
  await runSuper(args);
  // Force run the generateTsAbis script
  await generateTsAbis(hre);
});

export default config;
// import * as dotenv from "dotenv";
// dotenv.config();
// import { HardhatUserConfig } from "hardhat/config";
// import "@nomicfoundation/hardhat-ethers";
// import "@nomicfoundation/hardhat-chai-matchers";
// import "@typechain/hardhat";
// import "hardhat-gas-reporter";
// import "solidity-coverage";
// import "@nomicfoundation/hardhat-verify";
// import "hardhat-deploy";
// import { task } from "hardhat/config";
// import generateTsAbis from "./scripts/generateTsAbis";

// // API Keys
// const providerApiKey = process.env.ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";
// const etherscanApiKey = process.env.ETHERSCAN_MAINNET_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";
// const etherscanOptimisticApiKey = process.env.ETHERSCAN_OPTIMISTIC_API_KEY || "RM62RDISS1RH448ZY379NX625ASG1N633R";
// const basescanApiKey = process.env.BASESCAN_API_KEY || "ZZZEIPMT1MNJ8526VV2Y744CA7TNZR64G6";

// // Private keys from environment
// const deployerPrivateKey =
//   process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Default hardhat account #0

// const config: HardhatUserConfig = {
//   solidity: {
//     compilers: [
//       {
//         version: "0.8.20",
//         settings: {
//           optimizer: {
//             enabled: true,
//             runs: 200,
//           },
//         },
//       },
//     ],
//   },
//   defaultNetwork: "localhost",

//   // Updated named accounts to match our deploy script structure
//   namedAccounts: {
//     deployer: {
//       default: 0, // First signer
//     },
//     auditor: {
//       default: 1, // Second signer
//     },
//     generalContractor: {
//       default: 2, // Third signer
//     },
//     client: {
//       default: 3, // Fourth signer
//     },
//     investor1: {
//       default: 4, // Fifth signer
//     },
//     investor2: {
//       default: 5, // Sixth signer
//     },
//     investor3: {
//       default: 6, // Seventh signer
//     },
//   },

//   networks: {
//     // View the networks that are pre-configured.
//     hardhat: {
//       forking: {
//         url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
//         enabled: process.env.MAINNET_FORKING_ENABLED === "true",
//       },
//       // Important: This ensures the right accounts are created in Hardhat's local network
//       accounts: {
//         count: 10,
//         mnemonic: "test test test test test test test test test test test junk",
//         path: "m/44'/60'/0'/0",
//       },
//       chainId: 31337,
//     },
//     localhost: {
//       url: "http://127.0.0.1:8545/",
//       chainId: 31337,
//     },
//     mainnet: {
//       url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     sepolia: {
//       url: `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     arbitrum: {
//       url: `https://arb-mainnet.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     arbitrumSepolia: {
//       url: `https://arb-sepolia.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     optimism: {
//       url: `https://opt-mainnet.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//       verify: {
//         etherscan: {
//           apiUrl: "https://api-optimistic.etherscan.io",
//           apiKey: etherscanOptimisticApiKey,
//         },
//       },
//     },
//     optimismSepolia: {
//       url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//       verify: {
//         etherscan: {
//           apiUrl: "https://api-sepolia-optimistic.etherscan.io",
//           apiKey: etherscanOptimisticApiKey,
//         },
//       },
//     },
//     polygon: {
//       url: `https://polygon-mainnet.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     polygonMumbai: {
//       url: `https://polygon-mumbai.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     polygonZkEvm: {
//       url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     polygonZkEvmTestnet: {
//       url: `https://polygonzkevm-testnet.g.alchemy.com/v2/${providerApiKey}`,
//       accounts: [deployerPrivateKey],
//     },
//     gnosis: {
//       url: "https://rpc.gnosischain.com",
//       accounts: [deployerPrivateKey],
//     },
//     chiado: {
//       url: "https://rpc.chiadochain.net",
//       accounts: [deployerPrivateKey],
//     },
//     base: {
//       url: "https://mainnet.base.org",
//       accounts: [deployerPrivateKey],
//       verify: {
//         etherscan: {
//           apiUrl: "https://api.basescan.org",
//           apiKey: basescanApiKey,
//         },
//       },
//     },
//     baseSepolia: {
//       url: "https://sepolia.base.org",
//       accounts: [deployerPrivateKey],
//       verify: {
//         etherscan: {
//           apiUrl: "https://api-sepolia.basescan.org",
//           apiKey: basescanApiKey,
//         },
//       },
//     },
//     scrollSepolia: {
//       url: "https://sepolia-rpc.scroll.io",
//       accounts: [deployerPrivateKey],
//     },
//     scroll: {
//       url: "https://rpc.scroll.io",
//       accounts: [deployerPrivateKey],
//     },
//     pgn: {
//       url: "https://rpc.publicgoods.network",
//       accounts: [deployerPrivateKey],
//     },
//     pgnTestnet: {
//       url: "https://sepolia.publicgoods.network",
//       accounts: [deployerPrivateKey],
//     },
//     celo: {
//       url: "https://forno.celo.org",
//       accounts: [deployerPrivateKey],
//     },
//     celoAlfajores: {
//       url: "https://alfajores-forno.celo-testnet.org",
//       accounts: [deployerPrivateKey],
//     },
//   },
//   // configuration for hardhat-verify plugin
//   etherscan: {
//     apiKey: `${etherscanApiKey}`,
//   },
//   // configuration for etherscan-verify from hardhat-deploy plugin
//   verify: {
//     etherscan: {
//       apiKey: `${etherscanApiKey}`,
//     },
//   },
//   sourcify: {
//     enabled: false,
//   },
//   gasReporter: {
//     enabled: process.env.REPORT_GAS !== undefined,
//     currency: "USD",
//     outputFile: "gas-report.txt",
//     noColors: true,
//   },
// };

// // Extend the deploy task
// task("deploy").setAction(async (args, hre, runSuper) => {
//   // Run the original deploy task
//   await runSuper(args);
//   // Force run the generateTsAbis script
//   await generateTsAbis(hre);
// });

// export default config;
