const { Wallet } = require('ethers');
const readline = require('readline');
const fs = require('fs');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to encrypt a private key using Wallet's encrypt method
async function encryptPrivateKey(privateKey, password) {
  const wallet = new Wallet(privateKey);
  return wallet.encrypt(password); // Encrypt private key with password
}

// Main function
async function main() {
  console.log("🔐 Private Key Encryption Tool 🔐");
  console.log("This tool will help you encrypt your private keys for safe storage in .env");
  console.log("----------------------------------------------------------------------");

  // Get or generate a secret key
  let secret = process.env.PRIVATE_KEY_SECRET;
  // Generate a mnemonic if no secret is found
  if (!secret) {
    secret = Wallet.createRandom().mnemonic.phrase; // Correctly extract the phrase
    console.log(`\n⚠️ No PRIVATE_KEY_SECRET found in .env file.`);
    console.log(`Generated a new secret key: ${secret}`);
    console.log(`IMPORTANT: Add this to your .env file as PRIVATE_KEY_SECRET=${secret}\n`);
  }

  // Get private keys to encrypt
  const roles = [
    { name: "DEPLOYER", envVar: "DEPLOYER_PRIVATE_KEY" },
    { name: "AUDITOR", envVar: "AUDITOR_PRIVATE_KEY" },
    { name: "GENERAL_CONTRACTOR", envVar: "GENERAL_CONTRACTOR_PRIVATE_KEY" },
    { name: "CLIENT", envVar: "CLIENT_PRIVATE_KEY" },
    { name: "INVESTOR1", envVar: "INVESTOR1_PRIVATE_KEY" },
    { name: "INVESTOR2", envVar: "INVESTOR2_PRIVATE_KEY" },
    { name: "INVESTOR3", envVar: "INVESTOR3_PRIVATE_KEY" },
  ];

  const results = [];

  // Helper function to prompt for input
  const askForKey = role => {
    return new Promise(resolve => {
      const envKey = process.env[role.envVar];
      if (envKey && envKey.startsWith("0x")) {
        console.log(`Found ${role.name} key in .env file.`);
        rl.question(`Encrypt ${role.name} key? (Y/n): `, async answer => {
          if (answer.toLowerCase() !== "n") {
            try {
              const encrypted = await encryptPrivateKey(envKey, secret);
              results.push({
                role: role.name,
                envVar: `${role.envVar}_ENCRYPTED`,
                encrypted,
              });
              console.log(`✅ ${role.name} key encrypted successfully.`);
            } catch (error) {
              console.error(`Failed to encrypt ${role.name} key:`, error);
            }
          } else {
            console.log(`⏩ Skipping ${role.name} key.`);
          }
          resolve();
        });
      } else {
        rl.question(`Enter ${role.name} private key (or press Enter to skip): `, async privateKey => {
          if (privateKey && privateKey.trim()) {
            // Make sure it has 0x prefix
            if (!privateKey.startsWith("0x")) {
              privateKey = "0x" + privateKey;
            }
            try {
              const encrypted = await encryptPrivateKey(privateKey, secret);
              results.push({
                role: role.name,
                envVar: `${role.envVar}_ENCRYPTED`,
                encrypted,
              });
              console.log(`✅ ${role.name} key encrypted successfully.`);
            } catch (error) {
              console.error(`Failed to encrypt ${role.name} key:`, error);
            }
          } else {
            console.log(`⏩ Skipping ${role.name} key.`);
          }
          resolve();
        });
      }
    });
  };

  // Process each role
  for (const role of roles) {
    await askForKey(role);
  }

  rl.close();

  // Display results in the requested format
  console.log("\n----------------------------------------------------------------------");
  console.log("🔑 Encrypted Keys (Add these to your .env file) 🔑\n");

  results.forEach(result => {
    console.log(`${result.envVar}=${result.encrypted}`);
  });

  console.log("\n⚠️ REMEMBER: Keep your PRIVATE_KEY_SECRET safe! Without it, you cannot decrypt these keys.");
  console.log("----------------------------------------------------------------------");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
