// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { CrowdFunding, SecurityToken, UtilityToken, EnergyToken } from "../typechain-types";

// describe("CrowdFunding - pledgeTokens function", function () {
//   // Variables to store contract instances and addresses
//   let crowdFunding: CrowdFunding;
//   let securityToken: SecurityToken;
//   let energyToken: EnergyToken;
//   let utilityToken: UtilityToken;
//   let owner: any;
//   let client: any;
//   let generalContractor: any;
//   let auditor: any;
//   //let investor: any;
//   let anotherAccount: any;

//   // Constants for test
//   const TARGET_AMOUNT = ethers.parseEther("100"); // 100 tokens as target
//   const INVESTMENT_PERIOD = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
//   const MILESTONE_AMOUNTS = [ethers.parseEther("50"), ethers.parseEther("50")]; // Two milestones of 50 tokens each
//   const PLEDGE_AMOUNT = ethers.parseEther("10"); // Amount to pledge for testing
//   const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens initial supply

//   before(async function () {
//     // Get signers
//     [owner, client, generalContractor, auditor, investor, anotherAccount] = await ethers.getSigners();

//     // Deploy SecurityToken contract
//     const SecurityTokenFactory = await ethers.getContractFactory("SecurityToken");
//     securityToken = (await SecurityTokenFactory.deploy(INITIAL_SUPPLY)) as SecurityToken;
//     await securityToken.waitForDeployment();

//     // Deploy UtilityToken contract
//     const UtilityTokenFactory = await ethers.getContractFactory("UtilityToken");
//     utilityToken = (await UtilityTokenFactory.deploy(INITIAL_SUPPLY)) as UtilityToken;
//     await utilityToken.waitForDeployment();

//     // Deploy EnergyToken contract
//     const EnergyTokenFactory = await ethers.getContractFactory("EnergyToken");
//     energyToken = (await EnergyTokenFactory.deploy("EnergyToken", "ET")) as EnergyToken;
//     await energyToken.waitForDeployment();

//     // Deploy CrowdFunding contract
//     const CrowdFundingFactory = await ethers.getContractFactory("CrowdFunding");
//     crowdFunding = (await CrowdFundingFactory.deploy(
//       await securityToken.getAddress(),
//       await utilityToken.getAddress(),
//       await energyToken.getAddress(),
//       INVESTMENT_PERIOD,
//       TARGET_AMOUNT,
//       auditor.address,
//       generalContractor.address,
//       client.address,
//       MILESTONE_AMOUNTS,
//     )) as CrowdFunding;
//     await crowdFunding.waitForDeployment();

//     // Set crowdFunding contract in EnergyToken
//     await energyToken.setCrowdFundingContract(await crowdFunding.getAddress());

//     // Transfer security tokens to client for testing
//     await securityToken.transfer(client.address, ethers.parseEther("200"));
//   });

//   describe("Access Control", function () {
//     it("should revert when called by non-client address", async function () {
//       await expect(crowdFunding.connect(anotherAccount).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
//         "Only the client can pledge tokens",
//       );

//       await expect(crowdFunding.connect(generalContractor).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
//         "Only the client can pledge tokens",
//       );

//       await expect(crowdFunding.connect(auditor).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
//         "Only the client can pledge tokens",
//       );
//     });
//   });

//   describe("Input Validation", function () {
//     it("should revert when pledge amount is zero", async function () {
//       await expect(crowdFunding.connect(client).pledgeTokens(0)).to.be.revertedWith(
//         "Pledge amount must be greater than zero",
//       );
//     });

//     it("should revert when allowance is too low", async function () {
//       // No approval given to contract
//       await expect(crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith("Allowance too low");
//     });
//   });

//   describe("Core Functionality", function () {
//     it("should successfully pledge tokens when all conditions are met", async function () {
//       // Approve crowdFunding contract to spend client's tokens
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

//       // Get initial balances
//       const initialClientBalance = await securityToken.balanceOf(client.address);
//       const initialContractBalance = await securityToken.balanceOf(await crowdFunding.getAddress());
//       const initialEnergyTokenSupply = await energyToken.totalSupply();

//       // Execute pledgeTokens function
//       await expect(crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT))
//         .to.emit(crowdFunding, "TokensPledged")
//         .withArgs(client.address, PLEDGE_AMOUNT);

//       // Verify token balances after pledge
//       expect(await securityToken.balanceOf(client.address)).to.equal(initialClientBalance - PLEDGE_AMOUNT);
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         initialContractBalance + PLEDGE_AMOUNT,
//       );

//       // Verify EnergyTokens were minted
//       expect(await energyToken.totalSupply()).to.equal(initialEnergyTokenSupply + PLEDGE_AMOUNT);
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(PLEDGE_AMOUNT);

//       // Verify tokensPledged flag is set to true
//       expect(await crowdFunding.tokensPledged()).to.be.true;
//     });

//     it("should allow multiple pledges from the client", async function () {
//       // Approve crowdFunding contract to spend more of client's tokens
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

//       // Get balances before second pledge
//       const clientBalanceBeforeSecondPledge = await securityToken.balanceOf(client.address);
//       const contractBalanceBeforeSecondPledge = await securityToken.balanceOf(await crowdFunding.getAddress());
//       const energyTokenSupplyBeforeSecondPledge = await energyToken.totalSupply();
//       const contractEnergyBalanceBeforeSecondPledge = await energyToken.balanceOf(await crowdFunding.getAddress());

//       // Second pledge
//       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

//       // Verify token balances after second pledge
//       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforeSecondPledge - PLEDGE_AMOUNT);
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractBalanceBeforeSecondPledge + PLEDGE_AMOUNT,
//       );

//       // Verify additional EnergyTokens were minted
//       expect(await energyToken.totalSupply()).to.equal(energyTokenSupplyBeforeSecondPledge + PLEDGE_AMOUNT);
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractEnergyBalanceBeforeSecondPledge + PLEDGE_AMOUNT,
//       );
//     });
//   });

//   describe("Edge Cases", function () {
//     it("should handle large pledge amounts correctly", async function () {
//       const LARGE_PLEDGE = ethers.parseEther("50"); // 50 tokens

//       // Approve crowdFunding contract to spend client's tokens
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), LARGE_PLEDGE);

//       // Get balances before large pledge
//       const clientBalanceBeforeLargePledge = await securityToken.balanceOf(client.address);
//       const contractBalanceBeforeLargePledge = await securityToken.balanceOf(await crowdFunding.getAddress());
//       const energyTokenSupplyBeforeLargePledge = await energyToken.totalSupply();
//       const contractEnergyBalanceBeforeLargePledge = await energyToken.balanceOf(await crowdFunding.getAddress());

//       // Execute pledgeTokens function with large amount
//       await crowdFunding.connect(client).pledgeTokens(LARGE_PLEDGE);

//       // Verify large token transfer was successful
//       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforeLargePledge - LARGE_PLEDGE);
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractBalanceBeforeLargePledge + LARGE_PLEDGE,
//       );
//       expect(await energyToken.totalSupply()).to.equal(energyTokenSupplyBeforeLargePledge + LARGE_PLEDGE);
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractEnergyBalanceBeforeLargePledge + LARGE_PLEDGE,
//       );
//     });

//     it("should work with emergency stop mechanism", async function () {
//       // Mint and approve more tokens for client
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

//       // Enable emergency stop
//       await crowdFunding.connect(owner).toggleEmergencyStop();
//       expect(await crowdFunding.emergencyStop()).to.be.true;

//       // Get balances before pledge
//       const clientBalanceBeforePledge = await securityToken.balanceOf(client.address);
//       const contractBalanceBeforePledge = await securityToken.balanceOf(await crowdFunding.getAddress());

//       // Pledge should still work (not affected by emergency stop)
//       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

//       // Verify pledge was successful while in emergency stop
//       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforePledge - PLEDGE_AMOUNT);
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractBalanceBeforePledge + PLEDGE_AMOUNT,
//       );

//       // Disable emergency stop for other tests
//       await crowdFunding.connect(owner).toggleEmergencyStop();
//       expect(await crowdFunding.emergencyStop()).to.be.false;
//     });

//     it("should handle pledge after funding has failed", async function () {
//       // Advance time past investment period
//       await ethers.provider.send("evm_setNextBlockTimestamp", [INVESTMENT_PERIOD + 1]);
//       await ethers.provider.send("evm_mine");

//       // Check funding status (should mark as failed since target not reached)
//       await crowdFunding.checkFundingStatus();

//       // Verify funding failed
//       expect(await crowdFunding.fundingFailed()).to.be.true;

//       // Approve more tokens for client
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

//       // Get balances before pledge
//       const clientBalanceBeforePledge = await securityToken.balanceOf(client.address);
//       const contractBalanceBeforePledge = await securityToken.balanceOf(await crowdFunding.getAddress());
//       const contractEnergyBalanceBeforePledge = await energyToken.balanceOf(await crowdFunding.getAddress());

//       // Pledge should still work after funding has failed
//       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

//       // Verify pledge was successful even though funding failed
//       expect(await securityToken.balanceOf(client.address)).to.equal(clientBalanceBeforePledge - PLEDGE_AMOUNT);
//       expect(await securityToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractBalanceBeforePledge + PLEDGE_AMOUNT,
//       );
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractEnergyBalanceBeforePledge + PLEDGE_AMOUNT,
//       );
//     });
//   });

//   describe("EnergyToken Integration", function () {
//     it("should fail if EnergyToken crowdFundingContract is not properly set", async function () {
//       // Deploy new instances for this specific test
//       const newEnergyToken = (await (
//         await ethers.getContractFactory("EnergyToken")
//       ).deploy("EnergyToken2", "ET2")) as EnergyToken;
//       await newEnergyToken.waitForDeployment();

//       const newCrowdFunding = (await (
//         await ethers.getContractFactory("CrowdFunding")
//       ).deploy(
//         await securityToken.getAddress(),
//         await utilityToken.getAddress(),
//         await newEnergyToken.getAddress(),
//         INVESTMENT_PERIOD + 86400, // Set to a future time to avoid funding failure
//         TARGET_AMOUNT,
//         auditor.address,
//         generalContractor.address,
//         client.address,
//         MILESTONE_AMOUNTS,
//       )) as CrowdFunding;
//       await newCrowdFunding.waitForDeployment();

//       // Note: we deliberately don't set the crowdFundingContract on newEnergyToken

//       // Approve tokens
//       await securityToken.connect(client).approve(await newCrowdFunding.getAddress(), PLEDGE_AMOUNT);

//       // The pledge should fail when attempting to mint energy tokens
//       await expect(newCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT)).to.be.revertedWith(
//         "Only crowdfunding contract can mint",
//       );
//     });

//     it("should properly mint energy tokens to the crowdfunding contract", async function () {
//       // Approve one more pledge
//       await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);

//       // Get current energy token balance
//       const contractEnergyBalanceBefore = await energyToken.balanceOf(await crowdFunding.getAddress());

//       // Make pledge
//       await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

//       // Verify energy tokens went to the crowdfunding contract, not the client
//       expect(await energyToken.balanceOf(await crowdFunding.getAddress())).to.equal(
//         contractEnergyBalanceBefore + PLEDGE_AMOUNT,
//       );
//       expect(await energyToken.balanceOf(client.address)).to.equal(0);
//     });
//   });
// });
// //--------------------

// // import { expect } from "chai";
// // import { ethers } from "hardhat";
// // import { CrowdFunding, SecurityToken, UtilityToken, EnergyToken } from "../typechain-types";

// // describe("CrowdFunding - invest function", function () {
// //   // Variables to store contract instances and addresses
// //   let crowdFunding: CrowdFunding;
// //   let securityToken: SecurityToken;
// //   let energyToken: EnergyToken;
// //   let utilityToken: UtilityToken;
// //   let owner: any;
// //   let client: any;
// //   let generalContractor: any;
// //   let auditor: any;
// //   let investor1: any;
// //   let investor2: any;
// //   let anotherAccount: any;

// //   // Constants for test
// //   const TARGET_AMOUNT = ethers.parseEther("100"); // 100 tokens as target
// //   const INVESTMENT_PERIOD = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
// //   const MILESTONE_AMOUNTS = [ethers.parseEther("50"), ethers.parseEther("50")]; // Two milestones of 50 tokens each
// //   const PLEDGE_AMOUNT = ethers.parseEther("10"); // Amount to pledge for testing
// //   const INVEST_AMOUNT = ethers.parseEther("25"); // Amount to invest for testing
// //   const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens initial supply

// //   before(async function () {
// //     // Get signers
// //     [owner, client, generalContractor, auditor, investor1, investor2, anotherAccount] = await ethers.getSigners();

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
// //       MILESTONE_AMOUNTS
// //     )) as CrowdFunding;
// //     await crowdFunding.waitForDeployment();

// //     // Set crowdFunding contract in EnergyToken
// //     await energyToken.setCrowdFundingContract(await crowdFunding.getAddress());

// //     // Transfer tokens to investors for testing
// //     await utilityToken.transfer(investor1.address, ethers.parseEther("5000"));
// //     await utilityToken.transfer(investor2.address, ethers.parseEther("5000"));

// //     // Approve and pledge tokens to enable investments
// //     await securityToken.transfer(client.address, ethers.parseEther("200"));
// //     await securityToken.connect(client).approve(await crowdFunding.getAddress(), PLEDGE_AMOUNT);
// //     await crowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);
// //   });

// //   describe("Prerequisites and Access Control", function () {
// //     it("should be accessible by any address", async function () {
// //       // Approve tokens for spending
// //       await utilityToken.connect(investor1).approve(await crowdFunding.getAddress(), INVEST_AMOUNT);
// //       await utilityToken.connect(investor2).approve(await crowdFunding.getAddress(), INVEST_AMOUNT);
// //       await utilityToken.connect(anotherAccount).approve(await crowdFunding.getAddress(), INVEST_AMOUNT);

// //       // Transfer some tokens to anotherAccount
// //       await utilityToken.transfer(anotherAccount.address, INVEST_AMOUNT);

// //       // All addresses should be able to invest
// //       await expect(crowdFunding.connect(investor1).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //       await expect(crowdFunding.connect(investor2).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //       await expect(crowdFunding.connect(anotherAccount).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //     });

// //     it("should require security tokens to be pledged first", async function () {
// //       // Deploy a new contract without pledging
// //       const newCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await newCrowdFunding.waitForDeployment();

// //       // Approve tokens
// //       await utilityToken.connect(investor1).approve(await newCrowdFunding.getAddress(), INVEST_AMOUNT);

// //       // Try to invest without pledging security tokens first
// //       await expect(
// //         newCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)
// //       ).to.be.revertedWith("INVEST: Security tokens not pledged");
// //     });
// //   });

// //   describe("Input Validation", function () {
// //     it("should revert when investment amount is zero", async function () {
// //       await expect(
// //         crowdFunding.connect(investor1).invest(0)
// //       ).to.be.revertedWith("INVEST: Zero amount");
// //     });

// //     it("should revert when investment period is over", async function () {
// //       // Deploy a contract with a past investment period
// //       const pastPeriod = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

// //       const expiredCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         pastPeriod,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await expiredCrowdFunding.waitForDeployment();

// //       // Set and pledge tokens
// //       await energyToken.setCrowdFundingContract(await expiredCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await expiredCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await expiredCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Approve investment
// //       await utilityToken.connect(investor1).approve(await expiredCrowdFunding.getAddress(), INVEST_AMOUNT);

// //       // Try to invest after investment period ended
// //       await expect(
// //         expiredCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)
// //       ).to.be.revertedWith("INVEST: Period ended");
// //     });

// //     it("should revert when target amount would be exceeded", async function () {
// //       // Calculate remaining amount to reach target
// //       const currentRaised = await crowdFunding.fundsRaised();
// //       const remainingToTarget = TARGET_AMOUNT - currentRaised;

// //       // Try to invest more than remaining amount
// //       const excessAmount = remainingToTarget + ethers.parseEther("1");
// //       await utilityToken.connect(investor1).approve(await crowdFunding.getAddress(), excessAmount);

// //       await expect(
// //         crowdFunding.connect(investor1).invest(excessAmount)
// //       ).to.be.revertedWith("INVEST: Target exceeded");

// //       // Invest exactly remaining amount should work
// //       if (remainingToTarget > 0) {
// //         await utilityToken.connect(investor1).approve(await crowdFunding.getAddress(), remainingToTarget);
// //         await expect(crowdFunding.connect(investor1).invest(remainingToTarget)).to.not.be.reverted;
// //       }
// //     });

// //     it("should revert when allowance is insufficient", async function () {
// //       // Deploy a new contract for clean state
// //       const newCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400, // Set a future time
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await newCrowdFunding.waitForDeployment();

// //       // Set crowdFunding and pledge tokens
// //       await energyToken.setCrowdFundingContract(await newCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await newCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await newCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Approve less than investment amount
// //       const approveAmount = ethers.parseEther("10");
// //       const investAmount = ethers.parseEther("15");
// //       await utilityToken.connect(investor1).approve(await newCrowdFunding.getAddress(), approveAmount);

// //       // Try to invest more than approved
// //       await expect(
// //         newCrowdFunding.connect(investor1).invest(investAmount)
// //       ).to.be.revertedWith("INVEST: Insufficient allowance");
// //     });

// //     it("should revert when balance is insufficient", async function () {
// //       // Create a new account with no tokens
// //       const emptyAccount = ethers.Wallet.createRandom().connect(ethers.provider);

// //       // Fund it with ETH for gas but not tokens
// //       await owner.sendTransaction({
// //         to: emptyAccount.address,
// //         value: ethers.parseEther("1")
// //       });

// //       // Try to invest
// //       await expect(
// //         crowdFunding.connect(emptyAccount).invest(INVEST_AMOUNT)
// //       ).to.be.revertedWith("INVEST: Insufficient balance");
// //     });
// //   });

// //   describe("Core Functionality", function () {
// //     it("should successfully invest when all conditions are met", async function () {
// //       // Reset with a new contract for clean state
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set crowdFunding and pledge tokens
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Approve tokens
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), INVEST_AMOUNT);

// //       // Get initial balances
// //       const initialInvestorBalance = await utilityToken.balanceOf(investor1.address);
// //       const initialContractBalance = await utilityToken.balanceOf(await freshCrowdFunding.getAddress());
// //       const initialFundsRaised = await freshCrowdFunding.fundsRaised();
// //       const initialPendingTokens = await freshCrowdFunding.pendingEnergyTokens(investor1.address);
// //       const initialInvestorBalance_contract = await freshCrowdFunding.investorBalances(investor1.address);

// //       // Make investment
// //       const investTx = await freshCrowdFunding.connect(investor1).invest(INVEST_AMOUNT);

// //       // Check for event emission
// //       await expect(investTx)
// //         .to.emit(freshCrowdFunding, "InvestmentReceived")
// //         .withArgs(investor1.address, INVEST_AMOUNT);

// //       // Verify state changes
// //       expect(await utilityToken.balanceOf(investor1.address)).to.equal(initialInvestorBalance - INVEST_AMOUNT);
// //       expect(await utilityToken.balanceOf(await freshCrowdFunding.getAddress())).to.equal(initialContractBalance + INVEST_AMOUNT);
// //       expect(await freshCrowdFunding.fundsRaised()).to.equal(initialFundsRaised + INVEST_AMOUNT);
// //       expect(await freshCrowdFunding.pendingEnergyTokens(investor1.address)).to.equal(initialPendingTokens + INVEST_AMOUNT);
// //       expect(await freshCrowdFunding.investorBalances(investor1.address)).to.equal(initialInvestorBalance_contract + INVEST_AMOUNT);

// //       // Verify return value (success)
// //       const receipt = await investTx.wait();
// //       expect(receipt?.status).to.equal(1);
// //     });

// //     it("should track multiple investments from the same investor", async function () {
// //       // Deploy fresh contract
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Approve tokens for multiple investments
// //       const firstAmount = ethers.parseEther("10");
// //       const secondAmount = ethers.parseEther("15");
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), firstAmount + secondAmount);

// //       // Make first investment
// //       await freshCrowdFunding.connect(investor1).invest(firstAmount);

// //       // Get balances after first investment
// //       const balanceAfterFirst = await freshCrowdFunding.investorBalances(investor1.address);
// //       const pendingAfterFirst = await freshCrowdFunding.pendingEnergyTokens(investor1.address);
// //       const raisedAfterFirst = await freshCrowdFunding.fundsRaised();

// //       // Make second investment
// //       await freshCrowdFunding.connect(investor1).invest(secondAmount);

// //       // Verify cumulative tracking
// //       expect(await freshCrowdFunding.investorBalances(investor1.address)).to.equal(balanceAfterFirst + secondAmount);
// //       expect(await freshCrowdFunding.pendingEnergyTokens(investor1.address)).to.equal(pendingAfterFirst + secondAmount);
// //       expect(await freshCrowdFunding.fundsRaised()).to.equal(raisedAfterFirst + secondAmount);
// //     });

// //     it("should track investments from multiple investors", async function () {
// //       // Deploy fresh contract
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Amounts for each investor
// //       const amount1 = ethers.parseEther("20");
// //       const amount2 = ethers.parseEther("30");

// //       // Approve and invest for investor1
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), amount1);
// //       await freshCrowdFunding.connect(investor1).invest(amount1);

// //       // Approve and invest for investor2
// //       await utilityToken.connect(investor2).approve(await freshCrowdFunding.getAddress(), amount2);
// //       await freshCrowdFunding.connect(investor2).invest(amount2);

// //       // Verify separate tracking for each investor
// //       expect(await freshCrowdFunding.investorBalances(investor1.address)).to.equal(amount1);
// //       expect(await freshCrowdFunding.investorBalances(investor2.address)).to.equal(amount2);
// //       expect(await freshCrowdFunding.pendingEnergyTokens(investor1.address)).to.equal(amount1);
// //       expect(await freshCrowdFunding.pendingEnergyTokens(investor2.address)).to.equal(amount2);

// //       // Verify total funds raised
// //       expect(await freshCrowdFunding.fundsRaised()).to.equal(amount1 + amount2);
// //     });

// //     it("should emit FundingSuccessful when target amount is reached", async function () {
// //       // Deploy fresh contract with smaller target for testing
// //       const smallTarget = ethers.parseUnits("1", 18); // 1 token with 18 decimals
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         smallTarget,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Invest almost to target
// //       const firstAmount = smallTarget - ethers.parseEther("10");
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), firstAmount);
// //       await freshCrowdFunding.connect(investor1).invest(firstAmount);

// //       // Verify not successful yet
// //       expect(await freshCrowdFunding.fundingSuccessful()).to.be.false;

// //       // Invest final amount to reach target
// //       const finalAmount = ethers.parseEther("10");
// //       await utilityToken.connect(investor2).approve(await freshCrowdFunding.getAddress(), finalAmount);

// //       // This investment should trigger success
// //       await expect(freshCrowdFunding.connect(investor2).invest(finalAmount))
// //         .to.emit(freshCrowdFunding, "FundingSuccessful")
// //         .withArgs(smallTarget, (await ethers.provider.getBlock("latest"))?.timestamp ?? 0); // Default to 0 if block is null

// //       // Verify state
// //       expect(await freshCrowdFunding.fundingSuccessful()).to.be.true;
// //       expect(await freshCrowdFunding.fundsRaised()).to.equal(smallTarget);
// //     });

// //     it("should not emit FundingSuccessful twice", async function () {
// //       // Deploy fresh contract with smaller target
// //       const smallTarget = ethers.parseEther("50");
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         smallTarget,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Reach target
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), smallTarget);
// //       await freshCrowdFunding.connect(investor1).invest(smallTarget);

// //       // Verify success state
// //       expect(await freshCrowdFunding.fundingSuccessful()).to.be.true;

// //       // Invest a bit more (should not emit FundingSuccessful again)
// //       const extraAmount = ethers.parseEther("5");
// //       await utilityToken.connect(investor2).approve(await freshCrowdFunding.getAddress(), extraAmount);

// //       // This should not emit FundingSuccessful
// //       await expect(freshCrowdFunding.connect(investor2).invest(extraAmount))
// //         .to.emit(freshCrowdFunding, "InvestmentReceived")
// //         .withArgs(investor2.address, extraAmount)
// //         .and.to.not.emit(freshCrowdFunding, "FundingSuccessful");
// //     });
// //   });

// //   describe("Contract State Interactions", function () {
// //     it("should revert when contract is stopped", async function () {
// //       // Deploy fresh contract
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Stop the contract
// //       await freshCrowdFunding.connect(owner).toggleEmergencyStop();
// //       expect(await freshCrowdFunding.emergencyStop()).to.be.true;

// //       // Approve tokens
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), INVEST_AMOUNT);

// //       // Try to invest while stopped
// //       await expect(
// //         freshCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)
// //       ).to.be.revertedWith("Contract is stopped");

// //       // Resume contract
// //       await freshCrowdFunding.connect(owner).toggleEmergencyStop();

// //       // Should be able to invest now
// //       await expect(freshCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //     });

// //     it("should work properly with nonReentrant modifier", async function () {
// //       // Testing the nonReentrant modifier directly is challenging without custom attack contracts
// //       // Here we verify basic functionality after modifier is applied

// //       // Deploy fresh contract
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         TARGET_AMOUNT,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);
// // )})});
// //       // Rapid sequential investments (shouldn't trigger reentrancy guard false positives)
// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), INVEST_AMOUNT.mul(3));

// //       await expect(freshCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //       await expect(freshCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //       await expect(freshCrowdFunding.connect(investor1).invest(INVEST_AMOUNT)).to.not.be.reverted;
// //     });
// //   });

// //   describe("Edge Cases", function () {
// //     it("should handle multiple small investments that sum to target", async function () {
// //       // Deploy fresh contract with smaller target
// //       const smallTarget = ethers.parseEther("50");
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         smallTarget,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Make multiple small investments
// //       const smallAmount = ethers.parseEther("5");
// //       const numInvestments = 10; // 5 * 10 = 50, which is the target

// //       await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), smallTarget);

// //       for (let i = 0; i < numInvestments; i++) {
// //         if (i < numInvestments - 1) {
// //           // Regular investment, no success event yet
// //           await expect(freshCrowdFunding.connect(investor1).invest(smallAmount))
// //             .to.emit(freshCrowdFunding, "InvestmentReceived")
// //             .and.to.not.emit(freshCrowdFunding, "FundingSuccessful");
// //         } else {
// //           // Final investment should trigger success
// //           await expect(freshCrowdFunding.connect(investor1).invest(smallAmount))
// //             .to.emit(freshCrowdFunding, "InvestmentReceived")
// //             .and.to.emit(freshCrowdFunding, "FundingSuccessful");
// //         }
// //       }

// //       // Verify state
// //       expect(await freshCrowdFunding.fundingSuccessful()).to.be.true;
// //       expect(await freshCrowdFunding.fundsRaised()).to.equal(smallTarget);
// //       expect(await freshCrowdFunding.investorBalances(investor1.address)).to.equal(smallTarget);
// //       expect(await freshCrowdFunding.pendingEnergyTokens(investor1.address)).to.equal(smallTarget);
// //     });

// //     it("should allow investments beyond target amount only until exact amount is reached", async function () {
// //       // Deploy fresh contract with smaller target
// //       const smallTarget = ethers.parseEther("100");
// //       const freshCrowdFunding = (await (await ethers.getContractFactory("CrowdFunding")).deploy(
// //         await securityToken.getAddress(),
// //         await utilityToken.getAddress(),
// //         await energyToken.getAddress(),
// //         INVESTMENT_PERIOD + 86400,
// //         smallTarget,
// //         auditor.address,
// //         generalContractor.address,
// //         client.address,
// //         MILESTONE_AMOUNTS
// //       )) as CrowdFunding;
// //       await freshCrowdFunding.waitForDeployment();

// //       // Set up and pledge
// //       await energyToken.setCrowdFundingContract(await freshCrowdFunding.getAddress());
// //       await securityToken.connect(client).approve(await freshCrowdFunding.getAddress(), PLEDGE_AMOUNT);
// //       await freshCrowdFunding.connect(client).pledgeTokens(PLEDGE_AMOUNT);

// //       // Invest 95% of target
// //       const firstAmount = BigInt(smallTarget).mul(95).div(100); // 95 tokens (ensure smallTarget is BigInt)
// // await utilityToken.connect(investor1).approve(await freshCrowdFunding.getAddress(), firstAmount);
// // await freshCrowdFunding.connect(investor1).invest(firstAmount);

// // // Try to invest more than the remaining amount
// // const remainingAmount = BigInt(smallTarget) - BigInt(firstAmount); // 5 tokens (convert both to BigInt before subtraction)
// // const excessAmount = remainingAmount + ethers.parseUnits("10", 18); // 15 tokens (convert excess to correct token units)

// //       await utilityToken.connect(investor2).approve(await freshCrowdFunding.getAddress(), excessAmount);
// //       await expect(freshCrowdFunding.connect(investor2).invest(excessAmount))
// //         .to.be.revertedWith("INVEST: Target exceeded");

// //       // Invest exactly the remaining amount
// //       await utilityToken.connect(investor2).approve(await freshCrowdFunding.getAddress(), remainingAmount);
// //       await expect(freshCrowdFunding.connect(investor2).invest(remainingAmount))
// //         .to.emit(freshCrowdFunding, "FundingSuccessful");

// //       // Verify final state
// //       expect(await freshCrowdFunding.fundsRaised()).to.equal(smallTarget);
// //       expect(await freshCrowdFunding.fundingSuccessful()).to.be.true;
// //     });
