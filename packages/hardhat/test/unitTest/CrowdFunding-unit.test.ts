// /* eslint-disable */

// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { time } from "@nomicfoundation/hardhat-network-helpers";
// import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
// import { CrowdFunding, SecurityToken, EnergyToken, MockUSDC } from "../../typechain-types";
// import { ContractTransactionReceipt, parseEther, keccak256, toUtf8Bytes, AbiCoder, concat } from "ethers";

// describe("CrowdFunding", function () {
//   // Contract instances
//   let crowdFunding: CrowdFunding;
//   let securityToken: SecurityToken;
//   let mockUSDC: MockUSDC;
//   let energyToken: EnergyToken;

//   // Signers/Addresses
//   let owner: HardhatEthersSigner;
//   let auditor: HardhatEthersSigner;
//   let generalContractor: HardhatEthersSigner;
//   let client: HardhatEthersSigner;
//   let investor1: HardhatEthersSigner;
//   let investor2: HardhatEthersSigner;
//   let energyProvider: HardhatEthersSigner;
//   let signers: HardhatEthersSigner[];

//   // Constants for tests
//   const INVESTMENT_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
//   const TARGET_AMOUNT = parseEther("1000"); // 1000 tokens
//   const MILESTONE_AMOUNTS = [parseEther("300"), parseEther("400"), parseEther("300")];
//   const CLAIM_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
//   const INVESTMENT_AMOUNT_1 = parseEther("500");
//   const INVESTMENT_AMOUNT_2 = parseEther("500");
//   const EXTRA_FUND_AMOUNT = parseEther("100");
//   const ENERGY_TOKEN_AMOUNT = parseEther("100");
//   const AGREEMENT_TERMS = "Agreement terms";
//   // Hardhat test private keys (for signing)
//   const HARDHAT_PRIVATE_KEYS = [
//     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
//     "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
//     "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
//     "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
//     "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // account #4
//   ];

//   // ----- HELPER FUNCTIONS -----

//   // Get event from transaction receipt
//   async function getEventFromTx(txReceipt: ContractTransactionReceipt, eventName: string, contract = crowdFunding) {
//     if (!txReceipt || !txReceipt.logs) {
//       return null;
//     }

//     const events = [];
//     for (const log of txReceipt.logs) {
//       try {
//         const parsedLog = contract.interface.parseLog({
//           topics: [...log.topics],
//           data: log.data,
//         });
//         if (parsedLog && parsedLog.name === eventName) {
//           events.push(parsedLog);
//         }
//       } catch (e) {
//         // Skip logs that can't be parsed
//       }
//     }

//     return events.length > 0 ? events[0] : null;
//   }

//   // Find signer index in signers array
//   function findSignerIndex(signer: HardhatEthersSigner) {
//     for (let i = 0; i < signers.length; i++) {
//       if (signers[i].address === signer.address) {
//         return i;
//       }
//     }
//     throw new Error("Signer not found in signers array");
//   }

//   // Sign agreement for general contractor
//   async function signAgreement(signer = generalContractor) {
//     console.log("\nSigning agreement...");
//     const agreementHash = keccak256(toUtf8Bytes(AGREEMENT_TERMS));
//     const domainSeparator = await crowdFunding.DOMAIN_SEPARATOR();

//     // Encode message for EIP-712
//     const messageHash = keccak256(
//       AbiCoder.defaultAbiCoder().encode(
//         ["bytes32", "address", "uint256"],
//         [agreementHash, await crowdFunding.getAddress(), (await ethers.provider.getNetwork()).chainId],
//       ),
//     );

//     // Create final EIP-712 digest
//     const digest = keccak256(concat([toUtf8Bytes("\x19\x01"), domainSeparator, messageHash]));

//     // Find signer index and use corresponding private key
//     const signerIndex = findSignerIndex(signer);
//     const privateKey = HARDHAT_PRIVATE_KEYS[signerIndex];

//     // Create wallet and sign the digest
//     const wallet = new ethers.Wallet(privateKey);
//     const signature = wallet.signingKey.sign(digest);

//     // Format signature correctly
//     const flatSig = concat([signature.r, signature.s, signature.v === 27 ? "0x1b" : "0x1c"]);

//     // Submit signed agreement
//     await crowdFunding.connect(signer).signAgreement(agreementHash, flatSig);
//     console.log(`Agreement signed by ${await signer.getAddress()}`);

//     return { agreementHash, flatSig };
//   }

//   // Pledge tokens by client
//   async function pledgeTokens() {
//     console.log("\nClient pledging tokens...");
//     const tx = await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//     await tx.wait();
//     console.log("Tokens pledged successfully");
//   }

//   // Complete funding process
//   async function completeFunding() {
//     console.log("\nInvestors completing funding...");
//     await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//     await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
//     console.log("Funding completed successfully");
//   }

//   // Verify a specific milestone
//   async function verifyMilestone(milestoneIndex: number) {
//     console.log(`\nVerifying milestone ${milestoneIndex}...`);
//     const tx = await crowdFunding.connect(auditor).verifyMilestone(milestoneIndex);
//     const receipt = await tx.wait();
//     console.log(`Milestone ${milestoneIndex} verified`);
//     return receipt;
//   }

//   // Verify all milestones
//   async function verifyAllMilestones() {
//     console.log("\nVerifying all milestones...");
//     for (let i = 0; i < MILESTONE_AMOUNTS.length; i++) {
//       await verifyMilestone(i);
//     }
//     console.log("All milestones verified");
//   }

//   // Create extra fund request
//   async function createExtraFundRequest(amount = EXTRA_FUND_AMOUNT, description = "Additional materials needed") {
//     console.log("\nCreating extra fund request...");
//     const proposalHash = keccak256(toUtf8Bytes("Extra fund proposal"));

//     const tx = await crowdFunding.connect(generalContractor).requestExtraFunds(proposalHash, amount, description);

//     const receipt = await tx.wait();
//     const event = await getEventFromTx(receipt!, "ExtraFundRequestCreated");
//     const requestId = Number(event!.args.requestId);

//     console.log(`Extra fund request created with ID: ${requestId}`);
//     return requestId;
//   }

//   // ----- SETUP FUNCTIONS -----

//   // Basic deployment setup
//   async function setupBasicDeployment() {
//     console.log("\n----- Setting up test environment -----");

//     // Get signers
//     signers = await ethers.getSigners();
//     [owner, auditor, generalContractor, client, investor1, investor2, energyProvider] = signers;

//     // Deploy tokens
//     console.log("\nDeploying tokens...");
//     const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
//     securityToken = await SecurityTokenFactory.deploy("Security Token", "ST");

//     const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
//     mockUSDC = await MockUSDCFactory.deploy("Mock USDC", "mUSDC");

//     const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
//     energyToken = await EnergyTokenFactory.deploy("Energy Token", "ET");

//     // Get current timestamp and set investment period
//     const currentTimestamp = await time.latest();
//     const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//     // Deploy CrowdFunding contract using the two-step pattern
//     console.log("\nDeploying CrowdFunding contract...");
//     const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//     crowdFunding = await CrowdFundingFactory.deploy(
//       await securityToken.getAddress(),
//       await mockUSDC.getAddress(),
//       await energyToken.getAddress(),
//       auditor.address,
//       generalContractor.address,
//       client.address,
//       CLAIM_PERIOD,
//     );

//     // Initialize contract
//     console.log("Initializing contract...");
//     await crowdFunding.initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS);

//     // Setup roles and tokens
//     await energyToken.grantRole(await energyToken.MINTER_ROLE(), await crowdFunding.getAddress());
//     await crowdFunding.setEnergyProvider(energyProvider.address);

//     // Mint tokens
//     await securityToken.mint(client.address, TARGET_AMOUNT);
//     await mockUSDC.mint(investor1.address, INVESTMENT_AMOUNT_1);
//     await mockUSDC.mint(investor2.address, INVESTMENT_AMOUNT_2);

//     // Approve tokens
//     await securityToken.connect(client).approve(await crowdFunding.getAddress(), TARGET_AMOUNT);
//     await mockUSDC.connect(investor1).approve(await crowdFunding.getAddress(), INVESTMENT_AMOUNT_1);
//     await mockUSDC.connect(investor2).approve(await crowdFunding.getAddress(), INVESTMENT_AMOUNT_2);

//     console.log("----- Basic test setup complete -----");

//     return { currentTimestamp, investmentPeriod };
//   }

//   // Setup with tokens pledged
//   async function setupWithTokensPledged() {
//     await setupBasicDeployment();
//     await pledgeTokens();
//   }

//   // Setup with funding completed
//   async function setupWithFundingCompleted() {
//     await setupWithTokensPledged();
//     await completeFunding();
//   }

//   // Setup with agreement signed
//   async function setupWithAgreementSigned() {
//     await setupWithFundingCompleted();
//     await signAgreement();
//   }

//   // Setup with all milestones verified
//   async function setupWithMilestonesVerified() {
//     await setupWithAgreementSigned();
//     await verifyAllMilestones();
//   }

//   // Main beforeEach for all tests
//   beforeEach(async function () {
//     await setupBasicDeployment();
//   });

//   // ----- TEST SUITES -----

//   describe("Initialization", function () {
//     let uninitializedContract: CrowdFunding;
//     let deploymentTimestamp: number;
//     let localSecurityToken: SecurityToken;
//     let localMockUSDC: MockUSDC;
//     let localEnergyToken: EnergyToken;
//     let localSigners: HardhatEthersSigner[];
//     let localOwner: HardhatEthersSigner;
//     let localAuditor: HardhatEthersSigner;
//     let localGeneralContractor: HardhatEthersSigner;
//     let localClient: HardhatEthersSigner;

//     beforeEach(async function () {
//       // Deploy tokens
//       const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
//       localSecurityToken = await SecurityTokenFactory.deploy("Security Token", "ST");

//       const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
//       localMockUSDC = await MockUSDCFactory.deploy("Mock USDC", "mUSDC");

//       const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
//       localEnergyToken = await EnergyTokenFactory.deploy("Energy Token", "ET");

//       // Get signers
//       localSigners = await ethers.getSigners();
//       [localOwner, localAuditor, localGeneralContractor, localClient] = localSigners;

//       // Deploy uninitialized contract
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       uninitializedContract = await CrowdFundingFactory.deploy(
//         await localSecurityToken.getAddress(),
//         await localMockUSDC.getAddress(),
//         await localEnergyToken.getAddress(),
//         localAuditor.address,
//         localGeneralContractor.address,
//         localClient.address,
//         CLAIM_PERIOD,
//       );

//       deploymentTimestamp = await time.latest();
//     });

//     it("Should initialize with correct parameters", async function () {
//       const investmentPeriod = deploymentTimestamp + INVESTMENT_PERIOD;

//       // Initialize
//       await uninitializedContract.initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS);

//       // Check proposal
//       const proposal = await uninitializedContract.proposal();
//       expect(proposal.investmentPeriod).to.equal(investmentPeriod);
//       expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);

//       // Check milestones
//       const milestoneCount = await uninitializedContract.getMilestoneCount();
//       expect(milestoneCount).to.equal(MILESTONE_AMOUNTS.length);

//       // Check domain separator
//       expect(await uninitializedContract.DOMAIN_SEPARATOR()).to.not.equal(ethers.ZeroHash);
//     });

//     it("Should prevent non-owner from initializing", async function () {
//       const investmentPeriod = deploymentTimestamp + INVESTMENT_PERIOD;
//       const nonOwner = localSigners[4]; // Use a different signer

//       // Attempt to initialize from non-owner account
//       await expect(
//         uninitializedContract.connect(nonOwner).initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS),
//       ).to.be.revertedWithCustomError(uninitializedContract, "OwnableUnauthorizedAccount");
//     });

//     it("Should validate milestone amounts during initialization", async function () {
//       const investmentPeriod = deploymentTimestamp + INVESTMENT_PERIOD;

//       // Test with zero milestone amount
//       const badMilestones = [parseEther("100"), parseEther("0"), parseEther("200")];
//       await expect(uninitializedContract.initialize(investmentPeriod, TARGET_AMOUNT, badMilestones)).to.be.revertedWith(
//         "Milestone amount must be greater than zero",
//       );

//       // Test with total exceeding target amount
//       const excessiveMilestones = [parseEther("500"), parseEther("500"), parseEther("500")];
//       await expect(
//         uninitializedContract.initialize(
//           investmentPeriod,
//           TARGET_AMOUNT, // 1000 tokens
//           excessiveMilestones, // 1500 tokens total
//         ),
//       ).to.be.revertedWith("Milestone amounts must not exceed target amount");
//     });

//     it("Should prevent initialization with past investment period", async function () {
//       // Use a timestamp in the past
//       const pastTimestamp = deploymentTimestamp - 1000;

//       await expect(
//         uninitializedContract.initialize(pastTimestamp, TARGET_AMOUNT, MILESTONE_AMOUNTS),
//       ).to.be.revertedWith("Investment period must be in the future");
//     });

//     it("Should prevent initializing more than once", async function () {
//       // First initialization
//       const investmentPeriod = deploymentTimestamp + INVESTMENT_PERIOD;
//       await uninitializedContract.initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS);

//       // Try to initialize again
//       await expect(
//         uninitializedContract.initialize(investmentPeriod + 100, TARGET_AMOUNT, MILESTONE_AMOUNTS),
//       ).to.be.revertedWith("Already initialized");
//     });
//   });

//   describe("Deployment", function () {
//     it("Should deploy with correct parameters", async function () {
//       expect(await crowdFunding.auditor()).to.equal(auditor.address);
//       expect(await crowdFunding.generalContractor()).to.equal(generalContractor.address);
//       expect(await crowdFunding.client()).to.equal(client.address);
//       expect(await crowdFunding.securityToken()).to.equal(await securityToken.getAddress());
//       expect(await crowdFunding.mockUSDC()).to.equal(await mockUSDC.getAddress());
//       expect(await crowdFunding.energyToken()).to.equal(await energyToken.getAddress());
//       expect(await crowdFunding.CLAIM_PERIOD()).to.equal(CLAIM_PERIOD);

//       // Check proposal details
//       const proposal = await crowdFunding.proposal();
//       expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);

//       // Check milestones
//       const milestoneCount = await crowdFunding.getMilestoneCount();
//       expect(milestoneCount).to.equal(MILESTONE_AMOUNTS.length);

//       for (let i = 0; i < milestoneCount; i++) {
//         const milestone = await crowdFunding.getMilestoneDetails(i);
//         expect(milestone[0]).to.equal(MILESTONE_AMOUNTS[i]);
//         expect(milestone[1]).to.be.false; // verified should be false
//         expect(milestone[2]).to.be.false; // fundsReleased should be false
//       }

//       // Check funding status
//       expect(await crowdFunding.fundingStatus()).to.equal(0); // Active

//       // Check domain separator
//       expect(await crowdFunding.DOMAIN_SEPARATOR()).to.not.equal(ethers.ZeroHash);
//     });

//     it("Should revert if invalid parameters are provided", async function () {
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       // Zero address for security token
//       await expect(
//         CrowdFundingFactory.deploy(
//           ethers.ZeroAddress,
//           await mockUSDC.getAddress(),
//           await energyToken.getAddress(),
//           auditor.address,
//           generalContractor.address,
//           client.address,
//           CLAIM_PERIOD,
//         ),
//       ).to.be.revertedWith("Security token cannot be zero address");

//       // Zero address for auditor
//       await expect(
//         CrowdFundingFactory.deploy(
//           await securityToken.getAddress(),
//           await mockUSDC.getAddress(),
//           await energyToken.getAddress(),
//           ethers.ZeroAddress, // zero address for auditor
//           generalContractor.address,
//           client.address,
//           CLAIM_PERIOD,
//         ),
//       ).to.be.revertedWith("Auditor cannot be zero address");

//       // Deploy contract for initialization tests
//       const validContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         CLAIM_PERIOD,
//       );

//       // Past investment period
//       await expect(
//         validContract.initialize(
//           currentTimestamp, // past or present time
//           TARGET_AMOUNT,
//           MILESTONE_AMOUNTS,
//         ),
//       ).to.be.revertedWith("Investment period must be in the future");

//       // Zero target amount
//       await expect(
//         validContract.initialize(
//           investmentPeriod,
//           0, // zero target amount
//           MILESTONE_AMOUNTS,
//         ),
//       ).to.be.revertedWith("Target amount must be greater than zero");

//       // Empty milestone array
//       await expect(
//         validContract.initialize(
//           investmentPeriod,
//           TARGET_AMOUNT,
//           [], // empty milestone array
//         ),
//       ).to.be.revertedWith("Must have at least one milestone");
//     });
//   });

//   describe("Token Pledging", function () {
//     it("Should allow client to pledge tokens", async function () {
//       const contractBalanceBefore = await securityToken.balanceOf(await crowdFunding.getAddress());

//       const tx = await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "TokensPledged");
//       expect(event).to.not.be.null;
//       expect(event!.args.pledger).to.equal(client.address);
//       expect(event!.args.amount).to.equal(TARGET_AMOUNT);

//       // Check state updates
//       expect(await crowdFunding.tokensPledged()).to.be.true;
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(TARGET_AMOUNT);
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(TARGET_AMOUNT);
//     });

//     it("Should revert if non-client tries to pledge tokens", async function () {
//       await expect(crowdFunding.connect(investor1).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith(
//         "Only client can call this function",
//       );
//     });

//     it("Should revert if pledge amount is zero", async function () {
//       await expect(crowdFunding.connect(client).pledgeTokens(0)).to.be.revertedWith(
//         "Pledge amount must be greater than zero",
//       );
//     });

//     it("Should revert if allowance is too low", async function () {
//       // Reset the approval to a low amount
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), parseEther("1"));

//       await expect(crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT)).to.be.revertedWith("Allowance too low");
//     });
//   });

//   describe("Investment Process", function () {
//     beforeEach(async function () {
//       await pledgeTokens();
//     });

//     it("Should allow investors to invest", async function () {
//       const investorBalanceBefore = await mockUSDC.balanceOf(investor1.address);
//       const contractBalanceBefore = await mockUSDC.balanceOf(await crowdFunding.getAddress());

//       const tx = await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "InvestmentReceived");
//       expect(event).to.not.be.null;
//       expect(event!.args.investor).to.equal(investor1.address);
//       expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

//       // Check state updates
//       expect(await crowdFunding.fundsRaised()).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await crowdFunding.investorBalances(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await crowdFunding.pendingEnergyTokens(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await mockUSDC.balanceOf(await crowdFunding.getAddress())).to.equal(INVESTMENT_AMOUNT_1);
//     });

//     it("Should mark funding as successful when target amount is reached", async function () {
//       // First investor invests
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

//       // Second investor invests, reaching target
//       const tx = await crowdFunding.connect(investor2).invest(INVESTMENT_AMOUNT_2);
//       const receipt = await tx.wait();

//       // Check for FundingSuccessful event
//       const fundingEvent = await getEventFromTx(receipt!, "FundingSuccessful");
//       expect(fundingEvent).to.not.be.null;

//       // Check for EnergyTokensReleased event
//       const energyEvent = await getEventFromTx(receipt!, "EnergyTokensReleased");
//       expect(energyEvent).to.not.be.null;

//       // Check state updates
//       expect(await crowdFunding.fundingStatus()).to.equal(1); // Successful
//       expect(await crowdFunding.fundsRaised()).to.equal(TARGET_AMOUNT);
//       expect(await crowdFunding.energyTokensReleased()).to.be.true;
//     });

//     it("Should mark funding as failed when investment period ends without reaching target", async function () {
//       // Invest less than the target amount
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

//       // Fast forward past the investment period
//       const proposal = await crowdFunding.proposal();
//       await time.increaseTo(Number(proposal.investmentPeriod) + 1);

//       // Update funding status manually
//       const tx = await crowdFunding.updateFundingStatus();
//       const receipt = await tx.wait();

//       // Check for FundingFailed event
//       const event = await getEventFromTx(receipt!, "FundingFailed");
//       expect(event).to.not.be.null;

//       // Check state update
//       expect(await crowdFunding.fundingStatus()).to.equal(2); // Failed
//     });

//     it("Should revert investment when various conditions aren't met", async function () {
//       // Take a snapshot before modifying time
//       const snapshotId = await ethers.provider.send("evm_snapshot", []);

//       // Deploy a new contract to test tokens not pledged scenario
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       const newContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         CLAIM_PERIOD,
//       );

//       // Initialize contract
//       await newContract.initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS);

//       // Tokens not pledged
//       await expect(newContract.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
//         "INVEST: Security tokens not pledged",
//       );

//       // Zero amount
//       await expect(crowdFunding.connect(investor1).invest(0)).to.be.revertedWith(
//         "INVEST: Amount must be greater than zero",
//       );

//       // After investment period
//       const proposal = await crowdFunding.proposal();
//       await time.increaseTo(Number(proposal.investmentPeriod) + 1);

//       await expect(crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
//         "INVEST: Investment period has ended",
//       );

//       // Instead of setting time back, revert to the previous snapshot
//       await ethers.provider.send("evm_revert", [snapshotId]);

//       // Exceed target amount
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);
//       const exceedAmount = TARGET_AMOUNT - INVESTMENT_AMOUNT_1 + parseEther("1");

//       // Mint more tokens to investor2 for this test
//       await mockUSDC.mint(investor2.address, exceedAmount);
//       await mockUSDC.connect(investor2).approve(await crowdFunding.getAddress(), exceedAmount);

//       await expect(crowdFunding.connect(investor2).invest(exceedAmount)).to.be.revertedWith(
//         "INVEST: Funding target exceeded",
//       );
//     });
//   });

//   describe("Claiming Energy Tokens", function () {
//     beforeEach(async function () {
//       await setupWithFundingCompleted();
//     });

//     it("Should allow investors to claim energy tokens", async function () {
//       const investorEnergyBalance = await energyToken.balanceOf(investor1.address);
//       const pendingTokens = await crowdFunding.pendingEnergyTokens(investor1.address);

//       const tx = await crowdFunding.connect(investor1).claimEnergyTokens();
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EnergyTokensClaimed");
//       expect(event).to.not.be.null;
//       expect(event!.args.investor).to.equal(investor1.address);
//       expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

//       // Check state updates
//       expect(await energyToken.balanceOf(investor1.address)).to.equal(INVESTMENT_AMOUNT_1);
//       expect(await crowdFunding.pendingEnergyTokens(investor1.address)).to.equal(0);
//     });

//     it("Should revert if investor tries to claim twice", async function () {
//       // Claim once
//       await crowdFunding.connect(investor1).claimEnergyTokens();

//       // Try to claim again
//       await expect(crowdFunding.connect(investor1).claimEnergyTokens()).to.be.revertedWith("No energy tokens to claim");
//     });

//     it("Should revert if funding isn't successful", async function () {
//       // Deploy new contract
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       const newContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         CLAIM_PERIOD,
//       );

//       // Initialize contract
//       await newContract.initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS);

//       await expect(newContract.connect(investor1).claimEnergyTokens()).to.be.revertedWith(
//         "Funding must be successful to claim tokens",
//       );
//     });
//   });

//   describe("Agreement and Milestone Management", function () {
//     beforeEach(async function () {
//       await setupWithFundingCompleted();
//     });

//     it("Should allow general contractor to sign agreement", async function () {
//       const { agreementHash, flatSig } = await signAgreement();

//       // Verify agreement is signed
//       expect(await crowdFunding.gcAgreement()).to.equal(true);
//     });

//     it("Should allow auditor to verify milestone", async function () {
//       // Sign agreement first
//       await signAgreement();

//       // Check milestone details before verification
//       const milestoneIndex = 0;
//       const milestoneBefore = await crowdFunding.getMilestoneDetails(milestoneIndex);
//       expect(milestoneBefore[1]).to.be.false; // verified should be false

//       // Verify milestone
//       const receipt = await verifyMilestone(milestoneIndex);

//       // Check event
//       const event = await getEventFromTx(receipt!, "MilestoneVerified");
//       expect(event).to.not.be.null;
//       expect(event!.args.milestoneIndex).to.equal(milestoneIndex);

//       // Check state update
//       const milestoneAfter = await crowdFunding.getMilestoneDetails(milestoneIndex);
//       expect(milestoneAfter[1]).to.be.true; // verified should be true
//     });

//     it("Should allow general contractor to withdraw funds for verified milestone", async function () {
//       // Sign agreement
//       await signAgreement();

//       // Verify milestone
//       const milestoneIndex = 0;
//       await verifyMilestone(milestoneIndex);

//       // Get GC's balance before withdrawal
//       const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

//       // Withdraw funds
//       const tx = await crowdFunding.connect(generalContractor).withdrawByGC(milestoneIndex);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "FundsWithdrawn");
//       expect(event).to.not.be.null;
//       expect(event!.args.milestoneIndex).to.equal(milestoneIndex);
//       expect(event!.args.amount).to.equal(MILESTONE_AMOUNTS[milestoneIndex]);

//       // Check state update
//       const milestone = await crowdFunding.getMilestoneDetails(milestoneIndex);
//       expect(milestone[2]).to.be.true; // fundsReleased should be true

//       // Check GC's balance increased
//       const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
//       expect(gcBalanceAfter - gcBalanceBefore).to.equal(MILESTONE_AMOUNTS[milestoneIndex]);
//     });

//     it("Should emit FinalMilestoneAchieved when last milestone is verified", async function () {
//       // Sign agreement
//       await signAgreement();

//       // Verify all milestones except the last one
//       for (let i = 0; i < MILESTONE_AMOUNTS.length - 1; i++) {
//         await verifyMilestone(i);
//       }

//       // Verify the last milestone
//       const lastMilestoneIndex = MILESTONE_AMOUNTS.length - 1;
//       const receipt = await verifyMilestone(lastMilestoneIndex);

//       // Check event
//       const event = await getEventFromTx(receipt!, "FinalMilestoneAchieved");
//       expect(event).to.not.be.null;

//       // Check state updates
//       expect(await crowdFunding.finalMilestoneAchieved()).to.be.true;

//       // Check creditClaimDeadline is set
//       const currentTime = await time.latest();
//       const claimDeadline = await crowdFunding.creditClaimDeadline();
//       expect(claimDeadline).to.closeTo(currentTime + CLAIM_PERIOD, 10); // Allow small time variance
//     });
//   });

//   describe("Extra Fund Requests", function () {
//     let requestId: number;

//     beforeEach(async function () {
//       // Setup with agreement signed
//       await setupWithAgreementSigned();

//       // Create extra fund request
//       requestId = await createExtraFundRequest();
//     });

//     it("Should allow auditor to approve extra fund request for voting", async function () {
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days

//       const tx = await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "ExtraFundRequestApproved");
//       expect(event).to.not.be.null;
//       expect(event!.args.requestId).to.equal(requestId);
//       expect(event!.args.votingDuration).to.equal(votingDuration);

//       // Check state update
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(request[3]).to.be.true; // auditorApproved should be true

//       const currentTime = await time.latest();
//       expect(request[4]).to.closeTo(currentTime + votingDuration, 10); // votingEndTime
//     });

//     it("Should allow investors to vote on approved extra fund requests", async function () {
//       // Approve request
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days
//       await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

//       // Investor1 votes in favor
//       const tx1 = await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, true);
//       const receipt1 = await tx1.wait();

//       // Check event
//       const event1 = await getEventFromTx(receipt1!, "ExtraFundVoteCast");
//       expect(event1).to.not.be.null;
//       expect(event1!.args.requestId).to.equal(requestId);
//       expect(event1!.args.voter).to.equal(investor1.address);
//       expect(event1!.args.support).to.be.true;
//       expect(event1!.args.stake).to.equal(INVESTMENT_AMOUNT_1);

//       // Investor2 votes against
//       const tx2 = await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, false);
//       const receipt2 = await tx2.wait();

//       // Check event
//       const event2 = await getEventFromTx(receipt2!, "ExtraFundVoteCast");
//       expect(event2).to.not.be.null;
//       expect(event2!.args.requestId).to.equal(requestId);
//       expect(event2!.args.voter).to.equal(investor2.address);
//       expect(event2!.args.support).to.be.false;
//       expect(event2!.args.stake).to.equal(INVESTMENT_AMOUNT_2);

//       // Check state update
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(request[5]).to.equal(INVESTMENT_AMOUNT_1); // votesFor
//       expect(request[6]).to.equal(INVESTMENT_AMOUNT_2); // votesAgainst
//     });

//     it("Should execute approved extra fund request after voting period", async function () {
//       // Approve request
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days
//       await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

//       // Investors vote (both in favor for this test)
//       await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, true);
//       await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, true);

//       // Fast forward past voting period
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       await time.increaseTo(Number(request[4]) + 1);

//       // Execute request
//       const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

//       const tx = await crowdFunding.connect(auditor).executeExtraFundRequest(requestId);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "ExtraFundRequestExecuted");
//       expect(event).to.not.be.null;
//       expect(event!.args.requestId).to.equal(requestId);
//       expect(event!.args.approved).to.be.true;

//       // Check state update
//       const updatedRequest = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(updatedRequest[7]).to.be.true; // executed should be true

//       // Check GC's balance increased
//       const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
//       expect(gcBalanceAfter - gcBalanceBefore).to.equal(EXTRA_FUND_AMOUNT);
//     });

//     it("Should reject extra fund request if majority votes against", async function () {
//       // Approve request
//       const votingDuration = 3 * 24 * 60 * 60; // 3 days
//       await crowdFunding.connect(auditor).approveExtraFundRequest(requestId, votingDuration);

//       // Investors vote (both against for this test)
//       await crowdFunding.connect(investor1).voteOnExtraFundRequest(requestId, false);
//       await crowdFunding.connect(investor2).voteOnExtraFundRequest(requestId, false);

//       // Fast forward past voting period
//       const request = await crowdFunding.getExtraFundRequestDetails(requestId);
//       await time.increaseTo(Number(request[4]) + 1);

//       // Execute request
//       const gcBalanceBefore = await mockUSDC.balanceOf(generalContractor.address);

//       const tx = await crowdFunding.connect(auditor).executeExtraFundRequest(requestId);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "ExtraFundRequestRejected");
//       expect(event).to.not.be.null;
//       expect(event!.args.requestId).to.equal(requestId);

//       // Check state update
//       const updatedRequest = await crowdFunding.getExtraFundRequestDetails(requestId);
//       expect(updatedRequest[7]).to.be.true; // executed should be true

//       // Check GC's balance didn't change
//       const gcBalanceAfter = await mockUSDC.balanceOf(generalContractor.address);
//       expect(gcBalanceAfter).to.equal(gcBalanceBefore);
//     });
//   });

//   describe("Energy Credits", function () {
//     beforeEach(async function () {
//       // Setup with all milestones verified
//       await setupWithMilestonesVerified();

//       // Claim energy tokens
//       await crowdFunding.connect(investor1).claimEnergyTokens();

//       // Approve energy token spending
//       await energyToken.connect(investor1).approve(await crowdFunding.getAddress(), ENERGY_TOKEN_AMOUNT);
//     });

//     it("Should allow investors to burn energy tokens for credits", async function () {
//       const tx = await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);
//       const receipt = await tx.wait();

//       // Check events
//       const burnEvent = await getEventFromTx(receipt!, "EnergyTokensBurned");
//       expect(burnEvent).to.not.be.null;
//       expect(burnEvent!.args.investor).to.equal(investor1.address);
//       expect(burnEvent!.args.amount).to.equal(ENERGY_TOKEN_AMOUNT);

//       const claimEvent = await getEventFromTx(receipt!, "EnergyCreditsClaimed");
//       expect(claimEvent).to.not.be.null;
//       expect(claimEvent!.args.investor).to.equal(investor1.address);

//       // Default rate is 1:1
//       const defaultRate = await crowdFunding.energyCreditRate();
//       expect(claimEvent!.args.credits).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate);

//       // Check state update
//       expect(await crowdFunding.totalTokensBurned()).to.equal(ENERGY_TOKEN_AMOUNT);

//       const redemptionDetails = await crowdFunding
//         .connect(investor1)
//         .getEnergyCreditRedemptionDetails(investor1.address);
//       expect(redemptionDetails[0]).to.equal(ENERGY_TOKEN_AMOUNT); // tokensBurned
//       expect(redemptionDetails[1]).to.equal(ENERGY_TOKEN_AMOUNT * defaultRate); // creditsEarned
//       expect(redemptionDetails[2]).to.be.false; // redeemed
//       expect(redemptionDetails[3]).to.be.false; // verified
//     });

//     it("Should allow energy provider to verify energy credit redemption", async function () {
//       // Burn tokens first
//       await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);

//       // Verify redemption
//       const tx = await crowdFunding.connect(energyProvider).verifyEnergyCreditRedemption(investor1.address);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EnergyCreditsVerified");
//       expect(event).to.not.be.null;
//       expect(event!.args.investor).to.equal(investor1.address);

//       // Check state update
//       const redemptionDetails = await crowdFunding
//         .connect(investor1)
//         .getEnergyCreditRedemptionDetails(investor1.address);
//       expect(redemptionDetails[3]).to.be.true; // verified should be true
//     });

//     it("Should allow owner to update energy credit rate", async function () {
//       const newRate = 2; // 1:2 conversion rate

//       const tx = await crowdFunding.setEnergyCreditRate(newRate);
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EnergyCreditRateUpdated");
//       expect(event).to.not.be.null;
//       expect(event!.args.newRate).to.equal(newRate);

//       // Check state update
//       expect(await crowdFunding.energyCreditRate()).to.equal(newRate);

//       // Test that the new rate is used
//       await crowdFunding.connect(investor1).burnAndClaimEnergyCredits(ENERGY_TOKEN_AMOUNT);

//       const redemptionDetails = await crowdFunding
//         .connect(investor1)
//         .getEnergyCreditRedemptionDetails(investor1.address);
//       expect(redemptionDetails[1]).to.equal(ENERGY_TOKEN_AMOUNT * BigInt(newRate)); // creditsEarned with new rate
//     });
//   });

//   describe("Emergency Stop", function () {
//     beforeEach(async function () {
//       await pledgeTokens();
//     });

//     it("Should allow owner to toggle emergency stop", async function () {
//       const tx = await crowdFunding.toggleEmergencyStop();
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "EmergencyToggled");
//       expect(event).to.not.be.null;
//       expect(event!.args.stopped).to.be.true;

//       // Check state update
//       expect(await crowdFunding.emergencyStop()).to.be.true;

//       // Toggle back
//       const tx2 = await crowdFunding.toggleEmergencyStop();
//       const receipt2 = await tx2.wait();

//       // Check event
//       const event2 = await getEventFromTx(receipt2!, "EmergencyToggled");
//       expect(event2).to.not.be.null;
//       expect(event2!.args.stopped).to.be.false;

//       // Check state update
//       expect(await crowdFunding.emergencyStop()).to.be.false;
//     });

//     it("Should prevent investing when emergency stop is active", async function () {
//       // Enable emergency stop
//       await crowdFunding.toggleEmergencyStop();

//       // Try to invest
//       await expect(crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1)).to.be.revertedWith(
//         "Contract is in emergency stop",
//       );
//     });
//   });

//   describe("Refund Claims", function () {
//     beforeEach(async function () {
//       // Pledge tokens
//       await pledgeTokens();

//       // Partial funding
//       await crowdFunding.connect(investor1).invest(INVESTMENT_AMOUNT_1);

//       // Fast forward past the investment period to make funding fail
//       const proposal = await crowdFunding.proposal();
//       await time.increaseTo(Number(proposal.investmentPeriod) + 1);

//       // Update funding status
//       await crowdFunding.updateFundingStatus();
//     });

//     it("Should allow investors to claim refunds when funding fails", async function () {
//       const investorBalanceBefore = await mockUSDC.balanceOf(investor1.address);

//       const tx = await crowdFunding.connect(investor1).claimRefund();
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "RefundClaimed");
//       expect(event).to.not.be.null;
//       expect(event!.args.investor).to.equal(investor1.address);
//       expect(event!.args.amount).to.equal(INVESTMENT_AMOUNT_1);

//       // Check state update
//       expect(await crowdFunding.hasWithdrawnRefund(investor1.address)).to.be.true;

//       // Check investor's balance increased
//       const investorBalanceAfter = await mockUSDC.balanceOf(investor1.address);
//       expect(investorBalanceAfter - investorBalanceBefore).to.equal(INVESTMENT_AMOUNT_1);
//     });

//     it("Should revert if investor tries to claim refund twice", async function () {
//       // Claim once
//       await crowdFunding.connect(investor1).claimRefund();

//       // Try to claim again
//       await expect(crowdFunding.connect(investor1).claimRefund()).to.be.revertedWith("Refund already claimed");
//     });

//     it("Should revert if funding hasn't failed", async function () {
//       // Deploy new contract with successful funding
//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + INVESTMENT_PERIOD;

//       const newContract = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await mockUSDC.getAddress(),
//         await energyToken.getAddress(),
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         CLAIM_PERIOD,
//       );

//       // Initialize contract
//       await newContract.initialize(investmentPeriod, TARGET_AMOUNT, MILESTONE_AMOUNTS);

//       // Grant the MINTER_ROLE to the new contract
//       await energyToken.grantRole(await energyToken.MINTER_ROLE(), await newContract.getAddress());

//       // Set up tokens for successful funding
//       await securityToken.mint(client.address, TARGET_AMOUNT);
//       await securityToken.connect(client).approve(await newContract.getAddress(), TARGET_AMOUNT);
//       await newContract.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Successful funding
//       await mockUSDC.mint(investor1.address, TARGET_AMOUNT);
//       await mockUSDC.connect(investor1).approve(await newContract.getAddress(), TARGET_AMOUNT);
//       await newContract.connect(investor1).invest(TARGET_AMOUNT);

//       // Try to claim refund
//       await expect(newContract.connect(investor1).claimRefund()).to.be.revertedWith("Funding has not failed");
//     });

//     it("Should allow client to withdraw security tokens when funding fails", async function () {
//       const clientBalanceBefore = await securityToken.balanceOf(client.address);
//       const contractSecurityBalance = await securityToken.balanceOf(await crowdFunding.getAddress());

//       // Withdraw security tokens
//       const tx = await crowdFunding.connect(client).withdrawSecurityTokens();
//       const receipt = await tx.wait();

//       // Check event
//       const event = await getEventFromTx(receipt!, "SecurityTokensWithdrawn");
//       expect(event).to.not.be.null;
//       expect(event!.args.generalContractor).to.equal(client.address);
//       expect(event!.args.amount).to.equal(TARGET_AMOUNT);

//       // Check state update
//       expect(await crowdFunding.securityTokensWithdrawn()).to.be.true;

//       // Check client balance increased
//       const clientBalanceAfter = await securityToken.balanceOf(client.address);
//       expect(clientBalanceAfter - clientBalanceBefore).to.equal(TARGET_AMOUNT);

//       // Check contract balance is zero
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(0);
//     });

//     it("Should prevent withdrawing security tokens if already withdrawn", async function () {
//       // Withdraw once
//       await crowdFunding.connect(client).withdrawSecurityTokens();

//       // Try to withdraw again
//       await expect(crowdFunding.connect(client).withdrawSecurityTokens()).to.be.revertedWith(
//         "Security tokens already withdrawn",
//       );
//     });

//     it("Should prevent non-client from withdrawing security tokens", async function () {
//       await expect(crowdFunding.connect(investor1).withdrawSecurityTokens()).to.be.revertedWith(
//         "Only client can call this function",
//       );
//     });
//   });
// });
