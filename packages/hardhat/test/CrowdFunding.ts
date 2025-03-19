// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { time } from "@nomicfoundation/hardhat-network-helpers";
// import { CrowdFunding, SecurityToken, EnergyToken } from "../typechain-types";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// describe("CrowdFunding", function () {
//   // Test variables
//   let crowdfunding: CrowdFunding;
//   let securityToken: SecurityToken;
//   let utilityToken: SecurityToken;
//   let energyToken: EnergyToken;
//   let owner: SignerWithAddress;
//   let auditor: SignerWithAddress;
//   let generalContractor: SignerWithAddress;
//   let client: SignerWithAddress;
//   let investor1: SignerWithAddress;
//   let investor2: SignerWithAddress;
//   let investor3: SignerWithAddress;

//   // Constants
//   const ONE_DAY = 86400;
//   const ONE_WEEK = ONE_DAY * 7;
//   const TARGET_AMOUNT = ethers.parseEther("1000");
//   const MILESTONE_AMOUNTS = [
//     ethers.parseEther("300"),
//     ethers.parseEther("400"),
//     ethers.parseEther("300")
//   ];

//   before(async () => {
//     // Get signers
//     [owner, auditor, generalContractor, client, investor1, investor2, investor3] = await ethers.getSigners();

//     // Deploy mock tokens
//     const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
//     securityToken = await SecurityTokenFactory.deploy("SecurityToken", "SECT") as SecurityToken;
//     await securityToken.waitForDeployment();

//     const UtilityTokenFactory = await ethers.getContractFactory("SecurityToken"); // Reusing token contract for simplicity
//     utilityToken = await UtilityTokenFactory.deploy("UtilityToken", "UTIL") as SecurityToken;
//     await utilityToken.waitForDeployment();

//     const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
//     energyToken = await EnergyTokenFactory.deploy("EnergyToken", "ERGY") as EnergyToken;
//     await energyToken.waitForDeployment();

//     // Set up investment period (1 week from now)
//     const currentTimestamp = await time.latest();
//     const investmentPeriod = currentTimestamp + ONE_WEEK;

//     // Deploy crowdfunding contract
//     const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//     crowdfunding = await CrowdFundingFactory.deploy(
//       await securityToken.getAddress(),
//       await utilityToken.getAddress(),
//       await energyToken.getAddress(),
//       investmentPeriod,
//       TARGET_AMOUNT,
//       auditor.address,
//       generalContractor.address,
//       client.address,
//       MILESTONE_AMOUNTS
//     ) as CrowdFunding;
//     await crowdfunding.waitForDeployment();

//     // Transfer tokens to participants
//     // Mint security tokens to client for pledging
//     await securityToken.mint(client.address, TARGET_AMOUNT);
//     // Mint utility tokens to investors
//     await utilityToken.mint(investor1.address, ethers.parseEther("400"));
//     await utilityToken.mint(investor2.address, ethers.parseEther("400"));
//     await utilityToken.mint(investor3.address, ethers.parseEther("400"));

//     // Set energy token crowdfunding address
//     await energyToken.setCrowdfundingAddress(await crowdfunding.getAddress());
//   });

//   describe("Deployment", function () {
//     it("Should set the correct state variables", async function () {
//       expect(await crowdfunding.auditor()).to.equal(auditor.address);
//       expect(await crowdfunding.generalContractor()).to.equal(generalContractor.address);
//       expect(await crowdfunding.client()).to.equal(client.address);
//       expect(await crowdfunding.securityToken()).to.equal(await securityToken.getAddress());
//       expect(await crowdfunding.utilityToken()).to.equal(await utilityToken.getAddress());
//       expect(await crowdfunding.energyToken()).to.equal(await energyToken.getAddress());

//       const proposal = await crowdfunding.proposal();
//       expect(proposal.targetAmount).to.equal(TARGET_AMOUNT);

//       // Check milestones
//       for (let i = 0; i < MILESTONE_AMOUNTS.length; i++) {
//         const milestone = await crowdfunding.milestones(i);
//         expect(milestone.amount).to.equal(MILESTONE_AMOUNTS[i]);
//         expect(milestone.verified).to.be.false;
//         expect(milestone.fundsReleased).to.be.false;
//       }
//     });
//   });

//   describe("Token Pledging", function () {
//     it("Should allow client to pledge security tokens", async function () {
//       // Approve tokens for transfer
//       await securityToken.connect(client).approve(await crowdfunding.getAddress(), TARGET_AMOUNT);

//       // Pledge tokens
//       await expect(crowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT))
//         .to.emit(crowdfunding, "TokensPledged")
//         .withArgs(client.address, TARGET_AMOUNT);

//       // Check token pledged status
//       expect(await crowdfunding.tokensPledged()).to.be.true;

//       // Check security token balance of contract
//       expect(await securityToken.balanceOf(await crowdfunding.getAddress())).to.equal(TARGET_AMOUNT);

//       // Check energy tokens minted to contract
//       expect(await energyToken.balanceOf(await crowdfunding.getAddress())).to.equal(TARGET_AMOUNT);
//     });

//     it("Should not allow non-client to pledge tokens", async function () {
//       await securityToken.connect(client).approve(await crowdfunding.getAddress(), TARGET_AMOUNT);
//       await expect(crowdfunding.connect(investor1).pledgeTokens(TARGET_AMOUNT))
//         .to.be.revertedWith("Only the client can pledge tokens");
//     });

//     it("Should fail if pledge amount is zero", async function () {
//       await expect(crowdfunding.connect(client).pledgeTokens(0))
//         .to.be.revertedWith("Pledge amount must be greater than zero");
//     });

//     it("Should fail if allowance is insufficient", async function () {
//       // Deploy a fresh contract to test with
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + ONE_WEEK;

//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const newCrowdfunding = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS
//       ) as CrowdFunding;
//       await newCrowdfunding.waitForDeployment();

//       // Don't approve
//       await expect(newCrowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT))
//         .to.be.revertedWith("Allowance too low");
//     });
//   });

//   describe("Investment", function () {
//     let freshCrowdfunding: CrowdFunding;

//     before(async () => {
//       // Deploy a fresh contract for investment tests
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + ONE_WEEK;

//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       freshCrowdfunding = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS
//       ) as CrowdFunding;
//       await freshCrowdfunding.waitForDeployment();

//       // Set energy token crowdfunding address
//       await energyToken.setCrowdfundingAddress(await freshCrowdfunding.getAddress());

//       // Pledge tokens
//       await securityToken.connect(client).approve(await freshCrowdfunding.getAddress(), TARGET_AMOUNT);
//       await freshCrowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Approve utility tokens for investment
//       await utilityToken.connect(investor1).approve(await freshCrowdfunding.getAddress(), ethers.parseEther("400"));
//       await utilityToken.connect(investor2).approve(await freshCrowdfunding.getAddress(), ethers.parseEther("400"));
//       await utilityToken.connect(investor3).approve(await freshCrowdfunding.getAddress(), ethers.parseEther("400"));
//     });

//     it("Should allow investors to invest", async function () {
//       await expect(freshCrowdfunding.connect(investor1).invest(ethers.parseEther("300")))
//         .to.emit(freshCrowdfunding, "InvestmentReceived")
//         .withArgs(investor1.address, ethers.parseEther("300"));

//       // Check investor balance
//       expect(await freshCrowdfunding.investorBalances(investor1.address)).to.equal(ethers.parseEther("300"));
//       expect(await freshCrowdfunding.fundsRaised()).to.equal(ethers.parseEther("300"));
//       expect(await freshCrowdfunding.pendingEnergyTokens(investor1.address)).to.equal(ethers.parseEther("300"));
//     });

//     it("Should automatically mark funding as successful when target is reached", async function () {
//       // Invest from multiple investors to reach target
//       await freshCrowdfunding.connect(investor2).invest(ethers.parseEther("400"));

//       // This should trigger funding successful
//       await expect(freshCrowdfunding.connect(investor3).invest(ethers.parseEther("300")))
//         .to.emit(freshCrowdfunding, "FundingSuccessful");

//       expect(await freshCrowdfunding.fundingSuccessful()).to.be.true;
//       expect(await freshCrowdfunding.energyTokensReleased()).to.be.true;
//     });

//     it("Should not allow investment before tokens are pledged", async function () {
//       // Deploy a fresh contract
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + ONE_WEEK;

//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const newCrowdfunding = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS
//       ) as CrowdFunding;
//       await newCrowdfunding.waitForDeployment();

//       await utilityToken.connect(investor1).approve(await newCrowdfunding.getAddress(), ethers.parseEther("100"));

//       // Try to invest before tokens are pledged
//       await expect(newCrowdfunding.connect(investor1).invest(ethers.parseEther("100")))
//         .to.be.revertedWith("INVEST: Security tokens not pledged");
//     });

//     it("Should not allow investment after investment period", async function () {
//       // Deploy a fresh contract
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + ONE_DAY; // Short period

//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const newCrowdfunding = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS
//       ) as CrowdFunding;
//       await newCrowdfunding.waitForDeployment();

//       // Pledge tokens
//       await securityToken.connect(client).approve(await newCrowdfunding.getAddress(), TARGET_AMOUNT);
//       await newCrowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Fast forward time to after investment period
//       await time.increase(ONE_DAY + 1);

//       await utilityToken.connect(investor1).approve(await newCrowdfunding.getAddress(), ethers.parseEther("100"));
//       await expect(newCrowdfunding.connect(investor1).invest(ethers.parseEther("100")))
//         .to.be.revertedWith("INVEST: Investment period has ended");
//     });

//     it("Should not allow investment after funding is successful", async function () {
//       // Try to invest more after target reached (using the freshCrowdfunding instance where funding is already successful)
//       await expect(freshCrowdfunding.connect(investor3).invest(ethers.parseEther("100")))
//         .to.be.revertedWith("INVEST: Funding already successful");
//     });

//     it("Should check funding status correctly", async function () {
//       // Deploy a fresh contract
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + ONE_DAY; // Short period

//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       const statusCrowdfunding = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS
//       ) as CrowdFunding;
//       await statusCrowdfunding.waitForDeployment();

//       // Pledge tokens
//       await securityToken.connect(client).approve(await statusCrowdfunding.getAddress(), TARGET_AMOUNT);
//       await statusCrowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Before investment period ends
//       expect(await statusCrowdfunding.checkFundingStatus()).to.be.false;

//       // Invest some amount but not enough
//       await utilityToken.connect(investor1).approve(await statusCrowdfunding.getAddress(), ethers.parseEther("300"));
//       await statusCrowdfunding.connect(investor1).invest(ethers.parseEther("300")); // Not reaching target

//       // After investment period with insufficient funds
//       await time.increase(ONE_DAY + 1);

//       expect(await statusCrowdfunding.checkFundingStatus()).to.be.true;
//       expect(await statusCrowdfunding.fundingFailed()).to.be.true;
//     });
//   });

//   describe("Emergency Stop", function () {
//     let emergencyCrowdfunding: CrowdFunding;

//     before(async () => {
//       // Deploy a fresh contract for emergency tests
//       const currentTimestamp = await time.latest();
//       const investmentPeriod = currentTimestamp + ONE_WEEK;

//       const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//       emergencyCrowdfunding = await CrowdFundingFactory.deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await energyToken.getAddress(),
//         investmentPeriod,
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS
//       ) as CrowdFunding;
//       await emergencyCrowdfunding.waitForDeployment();

//       // Pledge tokens
//       await securityToken.connect(client).approve(await emergencyCrowdfunding.getAddress(), TARGET_AMOUNT);
//       await emergencyCrowdfunding.connect(client).pledgeTokens(TARGET_AMOUNT);

//       // Approve utility tokens for investment
//       await utilityToken.connect(investor1).approve(await emergencyCrowdfunding.getAddress(), ethers.parseEther("100"));
//     });

//     it("Should allow owner to toggle emergency stop", async function () {
//       await expect(emergencyCrowdfunding.connect(owner).toggleEmergencyStop())
//         .to.emit(emergencyCrowdfunding, "EmergencyToggled")
//         .withArgs(true);

//       expect(await emergencyCrowdfunding.emergencyStop()).to.be.true;

//       await expect(emergencyCrowdfunding.connect(owner).toggleEmergencyStop())
//         .to.emit(emergencyCrowdfunding, "EmergencyToggled")
//         .withArgs(false);

//       expect(await emergencyCrowdfunding.emergencyStop()).to.be.false;
//     });

//     it("Should prevent investment when emergency stop is active", async function () {
//       // Enable emergency stop
//       await emergencyCrowdfunding.connect(owner).toggleEmergencyStop();

//       // Try to invest
//       await expect(emergencyCrowdfunding.connect(investor1).invest(ethers.parseEther("100")))
//         .to.be.revertedWith("Contract is in emergency stop");
//     });

//     it("Should not allow non-owner to toggle emergency stop", async function () {
//       await expect(emergencyCrowdfunding.connect(investor1).toggleEmergencyStop())
//         .to.be.revertedWith("Ownable: caller is not the owner");
//     });
//   });

//   // Note: Additional test suites would typically include:
//   // 1. Milestone verification by auditor
//   // 2. Fund withdrawal by general contractor
//   // 3. Extra fund requests and voting
//   // 4. Refund claiming when funding fails
//   // 5. Energy token claiming and transfer
//   // 6. Security token withdrawal
// });

// //----------------------------------------------------------------

// // import { expect } from "chai";
// // import { ethers } from "hardhat";
// // import { CrowdFunding, SecurityToken, UtilityToken, EnergyToken } from "../typechain-types";

// // describe("CrowdFunding - pledgeTokens function", function () {
// //   // Variables to store contract instances and addresses
// //   let crowdFunding: CrowdFunding;
// //   let securityToken: SecurityToken;
// //   let energyToken: EnergyToken;
// //   let utilityToken: UtilityToken;
// //   let owner: any;
// //   let client: any;
// //   let generalContractor: any;
// //   let auditor: any;
// //   let investor: any;
// //   let anotherAccount: any;

// //   // Constants for test
// //   const TARGET_AMOUNT = ethers.parseEther("100"); // 100 tokens as target
// //   const INVESTMENT_PERIOD = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
// //   const MILESTONE_AMOUNTS = [ethers.parseEther("50"), ethers.parseEther("50")]; // Two milestones of 50 tokens each
// //   const PLEDGE_AMOUNT = ethers.parseEther("10"); // Amount to pledge for testing
// //   const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens initial supply

// //   before(async function () {
// //     // Get signers
// //     [owner, client, generalContractor, auditor, investor, anotherAccount] = await ethers.getSigners();

// //     // Deploy SecurityToken contract
// //     const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
// //     securityToken = (await SecurityTokenFactory.deploy(INITIAL_SUPPLY)) as SecurityToken;
// //     await securityToken.waitForDeployment();

// //     // Deploy UtilityToken contract
// //     const UtilityTokenFactory = await ethers.getContractFactory("UtilityToken");
// //     utilityToken = (await UtilityTokenFactory.deploy(INITIAL_SUPPLY)) as UtilityToken;
// //     await utilityToken.waitForDeployment();

// //     // Deploy EnergyToken contract
// //     const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
// //     energyToken = (await EnergyTokenFactory.deploy("EnergyToken", "ET")) as EnergyToken;
// //     await energyToken.waitForDeployment();

// //     // Deploy CrowdFunding contract
// //     const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
// //     crowdFunding = (await CrowdFundingFactory.deploy(
// //       await securityToken.getAddress(),
// //       await utilityToken.getAddress(),
// //       await energyToken.getAddress(),
// //       INVESTMENT_PERIOD,
// //       TARGET_AMOUNT,
// //       auditor.address,
// //       generalContractor.address,
// //       client.address,
// //       MILESTONE_AMOUNTS,
// //     )) as CrowdFunding;
// //     await crowdFunding.waitForDeployment();

// //     // Set crowdFunding contract in EnergyToken
// //     await energyToken.setCrowdFundingContract(await crowdFunding.getAddress());

// //     // Transfer security tokens to client for testing
// //     await securityToken.transfer(client.address, ethers.parseEther("200"));
// //   });

// //   describe("Access Control", function () {
// //     it("should revert when called by non-client address", async function () {
// //       await expect(crowdFunding.connect(anotherAccount).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
// //         "Only the client can pledge tokens",
// //       );

// //       await expect(crowdFunding.connect(generalContractor).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
// //         "Only the client can pledge tokens",
// //       );

// //       await expect(crowdFunding.connect(auditor).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
// //         "Only the client can pledge tokens",
// //       );
// //     });
// //   });

// //   describe("Input Validation", function () {
// //     it("should revert when pledge amount is zero", async function () {
// //       await expect(crowdFunding.connect(client).pledgeTokens(0)).to.be.revertedWith(
// //         "Pledge amount must be greater than zero",
// //       );
// //     });

// //     it("should revert when allowance is too low", async function () {
// //       // No approval given to contract
// //       await expect(crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith("Allowance too low");
// //     });
// //   });

// //   describe("Core Functionality", function () {
// //     it("should successfully pledge tokens when all conditions are met", async function () {
// //       // Approve crowdFunding contract to spend client's tokens
// //       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

// //       // Get initial balances
// //       const initialClientBalance = await securityToken.balanceOf(client.address);
// //       const initialContractBalance = await securityToken.balanceOf(await crowdFunding.getAddress());
// //       const initialEnergyTokenSupply = await energyToken.totalSupply();

// //       // Execute pledgeTokens function
// //       await expect(crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT))
// //         .to.emit(crowdFunding, "TokensPledged")
// //         .withArgs(client.address, PLEDGE_AMOUNT);

// //       // Verify token balances after pledge
// //       expect(await securityToken.balanceOf(client.address)).to.equal(initialClientBalance - PLEDGE_AMOUNT);
// //       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         initialContractBalance + PLEDGE_AMOUNT,
// //       );

// //       // Verify EnergyTokens were minted
// //       expect(await energyToken.totalSupply()).to.equal(initialEnergyTokenSupply + PLEDGE_AMOUNT);
// //       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(PLEDGE_AMOUNT);

// //       // Verify tokensPledged flag is set to true
// //       expect(await crowdFunding.tokensPledged()).to.be.true;
// //     });

// //     it("should allow multiple pledges from the client", async function () {
// //       // Approve crowdFunding contract to spend more of client's tokens
// //       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

// //       // Get balances before second pledge
// //       const clientBalanceBeforeSecondPledge = await securityToken.balanceOf(client.address);
// //       const contractBalanceBeforeSecondPledge = await securityToken.balanceOf(await crowdFunding.getAddress());
// //       const energyTokenSupplyBeforeSecondPledge = await energyToken.totalSupply();
// //       const contractEnergyBalanceBeforeSecondPledge = await energyToken.balanceOf(await crowdFunding.getAddress());

// //       // Second pledge
// //       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Verify token balances after second pledge
// //       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforeSecondPledge - PLEDGE_AMOUNT);
// //       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractBalanceBeforeSecondPledge + PLEDGE_AMOUNT,
// //       );

// //       // Verify additional EnergyTokens were minted
// //       expect(await energyToken.totalSupply()).to.equal(energyTokenSupplyBeforeSecondPledge + PLEDGE_AMOUNT);
// //       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractEnergyBalanceBeforeSecondPledge + PLEDGE_AMOUNT,
// //       );
// //     });
// //   });

// //   describe("Edge Cases", function () {
// //     it("should handle large pledge amounts correctly", async function () {
// //       const LARGE_PLEDGE = ethers.parseEther("50"); // 50 tokens

// //       // Approve crowdFunding contract to spend client's tokens
// //       await securityToken.connect(client).approve(await crowdFunding.getAddress(), LARGE_PLEDGE);

// //       // Get balances before large pledge
// //       const clientBalanceBeforeLargePledge = await securityToken.balanceOf(client.address);
// //       const contractBalanceBeforeLargePledge = await securityToken.balanceOf(await crowdFunding.getAddress());
// //       const energyTokenSupplyBeforeLargePledge = await energyToken.totalSupply();
// //       const contractEnergyBalanceBeforeLargePledge = await energyToken.balanceOf(await crowdFunding.getAddress());

// //       // Execute pledgeTokens function with large amount
// //       await crowdFunding.connect(client).pledgeTokens(LARGE_PLEDGE);

// //       // Verify large token transfer was successful
// //       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforeLargePledge - LARGE_PLEDGE);
// //       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractBalanceBeforeLargePledge + LARGE_PLEDGE,
// //       );
// //       expect(await energyToken.totalSupply()).to.equal(energyTokenSupplyBeforeLargePledge + LARGE_PLEDGE);
// //       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractEnergyBalanceBeforeLargePledge + LARGE_PLEDGE,
// //       );
// //     });

// //     it("should work with emergency stop mechanism", async function () {
// //       // Mint and approve more tokens for client
// //       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

// //       // Enable emergency stop
// //       await crowdFunding.connect(owner).toggleEmergencyStop();
// //       expect(await crowdFunding.emergencyStop()).to.be.true;

// //       // Get balances before pledge
// //       const clientBalanceBeforePledge = await securityToken.balanceOf(client.address);
// //       const contractBalanceBeforePledge = await securityToken.balanceOf(await crowdFunding.getAddress());

// //       // Pledge should still work (not affected by emergency stop)
// //       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Verify pledge was successful while in emergency stop
// //       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforePledge - PLEDGE_AMOUNT);
// //       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractBalanceBeforePledge + PLEDGE_AMOUNT,
// //       );

// //       // Disable emergency stop for other tests
// //       await crowdFunding.connect(owner).toggleEmergencyStop();
// //       expect(await crowdFunding.emergencyStop()).to.be.false;
// //     });

// //     it("should handle pledge after funding has failed", async function () {
// //       // Advance time past investment period
// //       await ethers.provider.send("evm_setNextBlockTimestamp", [INVESTMENT_PERIOD + 1]);
// //       await ethers.provider.send("evm_mine");

// //       // Check funding status (should mark as failed since target not reached)
// //       await crowdFunding.checkFundingStatus();

// //       // Verify funding failed
// //       expect(await crowdFunding.fundingFailed()).to.be.true;

// //       // Approve more tokens for client
// //       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

// //       // Get balances before pledge
// //       const clientBalanceBeforePledge = await securityToken.balanceOf(client.address);
// //       const contractBalanceBeforePledge = await securityToken.balanceOf(await crowdFunding.getAddress());
// //       const contractEnergyBalanceBeforePledge = await energyToken.balanceOf(await crowdFunding.getAddress());

// //       // Pledge should still work after funding has failed
// //       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Verify pledge was successful even though funding failed
// //       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforePledge - PLEDGE_AMOUNT);
// //       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractBalanceBeforePledge + PLEDGE_AMOUNT,
// //       );
// //       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractEnergyBalanceBeforePledge + PLEDGE_AMOUNT,
// //       );
// //     });
// //   });

// //   describe("EnergyToken Integration", function () {
// //     it("should fail if EnergyToken crowdFundingContract is not properly set", async function () {
// //       // Deploy new instances for this specific test
// //       const newEnergyToken = (await (
// //         await ethers.getContractFactory("EnergyToken")
// //       ).deploy("EnergyToken2", "ET2")) as EnergyToken;
// //       await newEnergyToken.waitForDeployment();

// //       const newCrowdFunding = (await (
// //         await ethers.getContractFactory("CrowdFunding")
// //       ).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await newEnergyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400, // Set to a future time to avoid funding failure
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS,
// //       )) as CrowdFunding;
// //       await newCrowdFunding.waitForDeployment();

// //       // Note: we deliberately don't set the crowdFundingContract on newEnergyToken

// //       // Approve tokens
// //       await securityToken.connect(client).approve(await newCrowdFunding.getAddress(), PLEDGE_AMOUNT);

// //       // The pledge should fail when attempting to mint energy tokens
// //       await expect(newCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
// //         "Only crowdfunding contract can mint",
// //       );
// //     });

// //     it("should properly mint energy tokens to the crowdfunding contract", async function () {
// //       // Approve one more pledge
// //       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

// //       // Get current energy token balance
// //       const contractEnergyBalanceBefore = await energyToken.balanceOf(await crowdFunding.getAddress());

// //       // Make pledge
// //       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Verify energy tokens went to the crowdfunding contract, not the client
// //       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
// //         contractEnergyBalanceBefore + PLEDGE_AMOUNT,
// //       );
// //       expect(await energyToken.balanceOf(client.address)).to.equal(0);
// //     });
// //   });
// // });
