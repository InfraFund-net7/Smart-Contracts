# Pre-Sale CrowdFunding Project

## Overview

This project implements a **CrowdFunding** contract that allows users to participate in funding energy-related projects using tokenized assets. The platform facilitates investment through multiple types of tokens, including a security token, mock USDC (for stable investments), and energy tokens.

### Key Features:

- **Security Token**: Used for participation and tracking ownership.
- **Mock USDC**: A stablecoin used for investments.
- **Energy Token**: Minted for milestones in the crowdfunding process.
- **Milestone-based Funding**: Users can participate in different milestones of the project.
- **Energy Provider**: Allows the energy provider to be set after deployment (defaults to auditor for simplicity).

## Getting Started

### Prerequisites

Before deploying the `CrowdFunding` contract, ensure that the following token contracts are deployed:

- **SecurityToken** (ERC20-based token for security)
- **MockUSDC** (ERC20 mock token for stablecoin use)
- **EnergyToken** (Token used for the energy-related crowdfunding)

### Installing Dependencies

1. Install **Hardhat** and the necessary dependencies:

   ```bash
   npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers @openzeppelin/contracts hardhat-deploy
   ```

2. Make sure that you have your Hardhat environment set up. If not, initialize a new Hardhat project:
   ```bash
   npx hardhat
   ```

## Deployment

The following deployment steps must be performed:

1. **Deploy Token Contracts**: Deploy the SecurityToken, MockUSDC, and EnergyToken contracts before running the deployment for the CrowdFunding contract.

2. **Deploy the CrowdFunding Contract**: After deploying the token contracts, deploy the CrowdFunding contract using the hardhat-deploy framework:

   ```bash
   npx hardhat deploy --tags CrowdFunding
   ```

3. **Post-Deployment Initialization**: Once the CrowdFunding contract is deployed, you must initialize and configure the contract. The necessary steps for initialization include:
   - Setting the investment period.
   - Defining milestone amounts.
   - Granting the MINTER_ROLE for the EnergyToken to the CrowdFunding contract.
   - Setting the EnergyProvider (defaults to the auditor).

### Example Post-Deployment Initialization:

The following configuration must be uncommented and adjusted as per your project requirements.

```javascript
// Example initialization parameters
const investmentPeriod = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days from now
const targetAmount = ethers.parseEther('1000'); // Total funding target
const milestoneAmounts = [
  ethers.parseEther('300'),
  ethers.parseEther('400'),
  ethers.parseEther('300'),
]; // Milestones

// Initialize the CrowdFunding contract
await crowdFunding.initialize(investmentPeriod, targetAmount, milestoneAmounts);
console.log('CrowdFunding contract initialized');

// Grant MINTER_ROLE to the CrowdFunding contract to mint energy tokens
const MINTER_ROLE = await energyToken.MINTER_ROLE();
await energyToken.grantRole(MINTER_ROLE, crowdFundingDeployment.address);
console.log('Granted MINTER_ROLE to CrowdFunding contract');

// Set the energy provider (typically the auditor)
await crowdFunding.setEnergyProvider(auditor);
console.log('Energy provider set to:', auditor);
```

## Smart Contract Documentation

### CrowdFunding Contract

This contract facilitates the crowdfunding process by allowing investments using various tokens. The contract tracks the progress of the crowdfunding campaign and ensures that funds are distributed according to milestones.

**Features:**

- **Security Token**: Used for tracking participation and ownership.
- **Mock USDC**: A stablecoin to facilitate investments in the project.
- **Energy Token**: A specialized token to mint energy units related to the project's milestones.
- **Milestones**: Investments are divided into milestones, allowing partial funding and claim periods.
- **Energy Provider**: Set to the auditor by default, but it can be changed.

### Deployment Process

The deployment process is performed using Hardhat and hardhat-deploy. Ensure the token contracts are deployed before the CrowdFunding contract.

The CrowdFunding contract is deployed with the following parameters:

- SecurityToken (Address of the deployed security token contract).
- MockUSDC (Address of the deployed mock USDC contract).
- EnergyToken (Address of the deployed energy token contract).
- Auditor (Address of the auditor).
- GeneralContractor (Address of the general contractor).
- Client (Address of the client).
- ClaimPeriod (Duration for claims in seconds).

After deployment, the contract is initialized using the investment period, target amount, and milestone amounts. These should be configured in the post-deployment script.

**Post-Deployment Steps:**

1. Grant the MINTER_ROLE to the CrowdFunding contract for minting energy tokens.
2. Set the EnergyProvider (typically the auditor).

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Example deployCrowdFunding.ts Script

```typescript
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

/**
 * Deploys the CrowdFunding contract and configures it with already deployed tokens.
 * This script should be run after the token deployment script.
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployCrowdFunding: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer, auditor, generalContractor, client } =
    await getNamedAccounts();

  console.log('Deploying CrowdFunding contract with the account:', deployer);
  console.log('Network:', hre.network.name);

  // Get previously deployed token addresses
  const securityTokenDeployment = await get('SecurityToken');
  const mockUSDCDeployment = await get('MockUSDC');
  const energyTokenDeployment = await get('EnergyToken');

  console.log('Using tokens:');
  console.log('SecurityToken:', securityTokenDeployment.address);
  console.log('MockUSDC:', mockUSDCDeployment.address);
  console.log('EnergyToken:', energyTokenDeployment.address);

  // Set claim period (30 days)
  const claimPeriod = 30 * 24 * 60 * 60;

  // Deploy CrowdFunding contract
  const crowdFundingDeployment = await deploy('CrowdFunding', {
    from: deployer,
    args: [
      securityTokenDeployment.address,
      mockUSDCDeployment.address,
      energyTokenDeployment.address,
      auditor,
      generalContractor,
      client,
      claimPeriod,
    ],
    log: true,
    autoMine: true,
  });
  console.log('CrowdFunding deployed to:', crowdFundingDeployment.address);

  // Post-deployment configuration
  const energyToken = await hre.ethers.getContractAt(
    'EnergyToken',
    energyTokenDeployment.address
  );
  const crowdFunding = await hre.ethers.getContractAt(
    'CrowdFunding',
    crowdFundingDeployment.address
  );

  // Example of initialization - modify according to your needs
  const investmentPeriod = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days from now
  const targetAmount = ethers.parseEther('1000');
  const milestoneAmounts = [
    ethers.parseEther('300'),
    ethers.parseEther('400'),
    ethers.parseEther('300'),
  ];

  await crowdFunding.initialize(
    investmentPeriod,
    targetAmount,
    milestoneAmounts
  );
  console.log('CrowdFunding contract initialized');

  const MINTER_ROLE = await energyToken.MINTER_ROLE();
  await energyToken.grantRole(MINTER_ROLE, crowdFundingDeployment.address);
  console.log('Granted MINTER_ROLE to CrowdFunding contract');

  await crowdFunding.setEnergyProvider(auditor);
  console.log('Energy provider set to:', auditor);
};

export default deployCrowdFunding;

deployCrowdFunding.tags = ['CrowdFunding'];
deployCrowdFunding.dependencies = ['Tokens'];
```

# 🏗 Scaffold-ETH 2

<h4 align="center">
  <a href="https://docs.scaffoldeth.io">Documentation</a> |
  <a href="https://scaffoldeth.io">Website</a>
</h4>

🧪 An open-source, up-to-date toolkit for building decentralized applications (dapps) on the Ethereum blockchain. It's designed to make it easier for developers to create and deploy smart contracts and build user interfaces that interact with those contracts.

⚙️ Built using NextJS, RainbowKit, Hardhat, Wagmi, Viem, and Typescript.

- ✅ **Contract Hot Reload**: Your frontend auto-adapts to your smart contract as you edit it.
- 🪝 **[Custom hooks](https://docs.scaffoldeth.io/hooks/)**: Collection of React hooks wrapper around [wagmi](https://wagmi.sh/) to simplify interactions with smart contracts with typescript autocompletion.
- 🧱 [**Components**](https://docs.scaffoldeth.io/components/): Collection of common web3 components to quickly build your frontend.
- 🔥 **Burner Wallet & Local Faucet**: Quickly test your application with a burner wallet and local faucet.
- 🔐 **Integration with Wallet Providers**: Connect to different wallet providers and interact with the Ethereum network.

![Debug Contracts tab](https://github.com/scaffold-eth/scaffold-eth-2/assets/55535804/b237af0c-5027-4849-a5c1-2e31495cccb1)

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## Quickstart

To get started with Scaffold-ETH 2, follow the steps below:

1. Install dependencies if it was skipped in CLI:

```
cd my-dapp-example
yarn install
```

2. Run a local network in the first terminal:

```
yarn chain
```

This command starts a local Ethereum network using Hardhat. The network runs on your local machine and can be used for testing and development. You can customize the network configuration in `packages/hardhat/hardhat.config.ts`.

3. On a second terminal, deploy the test contract:

```
yarn deploy
```

This command deploys a test smart contract to the local network. The contract is located in `packages/hardhat/contracts` and can be modified to suit your needs. The `yarn deploy` command uses the deploy script located in `packages/hardhat/deploy` to deploy the contract to the network. You can also customize the deploy script.

4. On a third terminal, start your NextJS app:

```
yarn start
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.

Run smart contract test with `yarn hardhat:test`

- Edit your smart contracts in `packages/hardhat/contracts`
- Edit your frontend homepage at `packages/nextjs/app/page.tsx`. For guidance on [routing](https://nextjs.org/docs/app/building-your-application/routing/defining-routes) and configuring [pages/layouts](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts) checkout the Next.js documentation.
- Edit your deployment scripts in `packages/hardhat/deploy`

## Documentation

Visit our [docs](https://docs.scaffoldeth.io) to learn how to start building with Scaffold-ETH 2.

To know more about its features, check out our [website](https://scaffoldeth.io).

## Contributing to Scaffold-ETH 2

We welcome contributions to Scaffold-ETH 2!

Please see [CONTRIBUTING.MD](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/CONTRIBUTING.md) for more information and guidelines for contributing to Scaffold-ETH 2.
