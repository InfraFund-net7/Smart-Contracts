// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { Signer, Contract } from "ethers";
// import { CrowdFunding } from "../typechain-types";

// describe("CrowdFunding Contract", function () {
//     let owner: Signer;
//     let client: Signer;
//     let auditor: Signer;
//     let generalContractor: Signer;
//     let investor1: Signer;
//     let investor2: Signer;

//     let securityToken: Contract;
//     let utilityToken: Contract;
//     let energyToken: Contract;
//     let crowdFunding: CrowdFunding;

//     before(async function () {
//         [owner, client, auditor, generalContractor, investor1, investor2] = await ethers.getSigners();
//     });

//     // Deployment and setup constants
//     const INVESTMENT_PERIOD = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
//     const TARGET_AMOUNT = ethers.parseEther('1000');
//     const MILESTONE_AMOUNTS = [
//         ethers.parseEther('300'),
//         ethers.parseEther('400'),
//         ethers.parseEther('300')
//     ];

//     beforeEach(async function () {
//         // Get signers
//         [owner, client, auditor, generalContractor, investor1, investor2] = await ethers.getSigners();

//         // Deploy mock tokens
//         const SecurityTokenFactory = await ethers.getContractFactory('SecurityToken');
//         securityToken = await SecurityTokenFactory.connect(client).deploy('Security Token', 'ST');

//         const UtilityTokenFactory = await ethers.getContractFactory('ERC20');
//         utilityToken = await UtilityTokenFactory.deploy('Utility Token', 'UT');

//         const EnergyTokenFactory = await ethers.getContractFactory('EnergyToken');
//         energyToken = await EnergyTokenFactory.deploy();

//         // Deploy CrowdFunding contract
//         const CrowdFundingFactory = await ethers.getContractFactory('CrowdFunding');
//         crowdFunding = await CrowdFundingFactory.deploy(
//             await securityToken.getAddress(),
//             await utilityToken.getAddress(),
//             await energyToken.getAddress(),
//             INVESTMENT_PERIOD,
//             TARGET_AMOUNT,
//             await auditor.getAddress(),
//             await generalContractor.getAddress(),
//             await client.getAddress(),
//             MILESTONE_AMOUNTS
//         );

//         // Mint and approve tokens for testing
//         await securityToken.connect(client).mint(await client.getAddress(), TARGET_AMOUNT);
//         await securityToken.connect(client).approve(await crowdFunding.getAddress(), TARGET_AMOUNT);

//         await utilityToken.connect(investor1).mint(await investor1.getAddress(), TARGET_AMOUNT);
//         await utilityToken.connect(investor1).approve(await crowdFunding.getAddress(), TARGET_AMOUNT);

//         await utilityToken.connect(investor2).mint(await investor2.getAddress(), TARGET_AMOUNT);
//         await utilityToken.connect(investor2).approve(await crowdFunding.getAddress(), TARGET_AMOUNT);
//     });

//     describe('Deployment', function () {
//         it('should deploy with correct initial parameters', async function () {
//             expect(await crowdFunding.client()).to.equal(await client.getAddress());
//             expect(await crowdFunding.auditor()).to.equal(await auditor.getAddress());
//             expect(await crowdFunding.generalContractor()).to.equal(await generalContractor.getAddress());
//             expect(await crowdFunding.proposal()).to.deep.include({
//                 investmentPeriod: INVESTMENT_PERIOD,
//                 targetAmount: TARGET_AMOUNT
//             });
//         });
//     });

//     describe('Token Pledging', function () {
//         it('should allow client to pledge security tokens', async function () {
//             await expect(crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT))
//                 .to.emit(crowdFunding, 'TokensPledged')
//                 .withArgs(await client.getAddress(), TARGET_AMOUNT);

//             expect(await crowdFunding.tokensPledged()).to.be.true;
//         });

//         it('should prevent non-client from pledging tokens', async function () {
//             await expect(crowdFunding.connect(investor1).pledgeTokens(TARGET_AMOUNT))
//                 .to.be.revertedWith('Only the client can pledge tokens');
//         });
//     });

//     describe('Investment Process', function () {
//         beforeEach(async function () {
//             // Pledge tokens before investing
//             await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//         });

//         it('should allow investment within funding period', async function () {
//             const investAmount = ethers.parseEther('500');

//             await expect(crowdFunding.connect(investor1).invest(investAmount))
//                 .to.emit(crowdFunding, 'InvestmentReceived')
//                 .withArgs(await investor1.getAddress(), investAmount);

//             expect(await crowdFunding.investorBalances(await investor1.getAddress())).to.equal(investAmount);
//             expect(await crowdFunding.fundsRaised()).to.equal(investAmount);
//         });

//         it('should prevent investment after funding period', async function () {
//             // Increase time past investment period
//             await ethers.provider.send('evm_setNextBlockTimestamp', [INVESTMENT_PERIOD + 1]);
//             await ethers.provider.send('evm_mine');

//             const investAmount = ethers.parseEther('500');
//             await expect(crowdFunding.connect(investor1).invest(investAmount))
//                 .to.be.revertedWith('INVEST: Investment period has ended');
//         });

//         it('should mark funding as failed if target not met', async function () {
//             const partialInvestment = ethers.parseEther('500');

//             await crowdFunding.connect(investor1).invest(partialInvestment);

//             // Increase time past investment period
//             await ethers.provider.send('evm_setNextBlockTimestamp', [INVESTMENT_PERIOD + 1]);
//             await ethers.provider.send('evm_mine');

//             // Check funding status
//             const fundingStatus = await crowdFunding.fundingStatus();
//             expect(fundingStatus).to.equal(1); // Failed status
//         });
//     });

//     describe('Refund Process', function () {
//         beforeEach(async function () {
//             await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//         });

//         it('should allow refund when funding fails', async function () {
//             const investAmount = ethers.parseEther('500');

//             await crowdFunding.connect(investor1).invest(investAmount);

//             // Increase time past investment period
//             await ethers.provider.send('evm_setNextBlockTimestamp', [INVESTMENT_PERIOD + 1]);
//             await ethers.provider.send('evm_mine');

//             // Claim refund
//             await expect(crowdFunding.connect(investor1).claimRefund())
//                 .to.emit(crowdFunding, 'RefundClaimed')
//                 .withArgs(await investor1.getAddress(), investAmount);
//         });

//         it('should prevent multiple refund claims', async function () {
//             const investAmount = ethers.parseEther('500');

//             await crowdFunding.connect(investor1).invest(investAmount);

//             // Increase time past investment period
//             await ethers.provider.send('evm_setNextBlockTimestamp', [INVESTMENT_PERIOD + 1]);
//             await ethers.provider.send('evm_mine');

//             // First refund claim
//             await crowdFunding.connect(investor1).claimRefund();

//             // Second refund claim should fail
//             await expect(crowdFunding.connect(investor1).claimRefund())
//                 .to.be.revertedWith('Refund already claimed');
//         });
//     });

//     describe('Milestone Verification and Funds Withdrawal', function () {
//         let agreementHash;

//         beforeEach(async function () {
//             // Complete full funding process
//             await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//             await crowdFunding.connect(investor1).invest(TARGET_AMOUNT);

//             // Create agreement hash
//             agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));

//             // Sign agreement
//             const signature = await signAgreement(generalContractor, agreementHash, crowdFunding);
//             await crowdFunding.connect(generalContractor).signAgreement(agreementHash, signature);
//         });

//         it('should allow auditor to verify milestone', async function () {
//             await expect(crowdFunding.connect(auditor).verifyMilestone(0))
//                 .to.emit(crowdFunding, 'MilestoneVerified')
//                 .withArgs(0);

//             const milestoneDetails = await crowdFunding.getMilestoneDetails(0);
//             expect(milestoneDetails.verified).to.be.true;
//         });

//         it('should allow general contractor to withdraw verified milestone funds', async function () {
//             // Verify first milestone
//             await crowdFunding.connect(auditor).verifyMilestone(0);

//             await expect(crowdFunding.connect(generalContractor).withdrawByGC(0))
//                 .to.emit(crowdFunding, 'FundsWithdrawn')
//                 .withArgs(0, MILESTONE_AMOUNTS[0]);
//         });

//         it('should prevent withdrawing unverified milestone', async function () {
//             await expect(crowdFunding.connect(generalContractor).withdrawByGC(0))
//                 .to.be.revertedWith('Milestone not verified');
//         });
//     });

//     describe('Extra Funds Request', function () {
//         let agreementHash;

//         beforeEach(async function () {
//             // Complete full funding process
//             await crowdFunding.connect(client).pledgeTokens(TARGET_AMOUNT);
//             await crowdFunding.connect(investor1).invest(TARGET_AMOUNT);

//             // Create agreement hash
//             agreementHash = ethers.keccak256(ethers.toUtf8Bytes('Project Agreement'));

//             // Sign agreement
//             const signature = await signAgreement(generalContractor, agreementHash, crowdFunding);
//             await crowdFunding.connect(generalContractor).signAgreement(agreementHash, signature);
//         });

//         it('should allow general contractor to request extra funds', async function () {
//             const extraFundAmount = ethers.parseEther('100');
//             const proposalHash = ethers.keccak256(ethers.toUtf8Bytes('Extra Fund Proposal'));

//             await expect(crowdFunding.connect(generalContractor).requestExtraFunds(
//                 proposalHash,
//                 extraFundAmount,
//                 'Additional materials needed'
//             )).to.emit(crowdFunding, 'ExtraFundRequestCreated');
//         });

//         it('should allow auditor to approve extra fund request for voting', async function () {
//             const extraFundAmount = ethers.parseEther('100');
//             const proposalHash = ethers.keccak256(ethers.toUtf8Bytes('Extra Fund Proposal'));

//             // Create extra fund request
//             await crowdFunding.connect(generalContractor).requestExtraFunds(
//                 proposalHash,
//                 extraFundAmount,
//                 'Additional materials needed'
//             );

//             // Approve request for voting
//             await expect(crowdFunding.connect(auditor).approveExtraFundRequest(0, 86400)) // 1 day voting period
//                 .to.emit(crowdFunding, 'ExtraFundRequestApproved');
//         });
//     });

//     // Utility function for signing agreement
//     async function signAgreement(signer, agreementHash, contract) {
//         const domain = {
//             name: 'CrowdFunding',
//             version: '1',
//             chainId: (await ethers.provider.getNetwork()).chainId,
//             verifyingContract: await contract.getAddress()
//         };

//         const types = {
//             AgreementSigning: [
//                 { name: 'agreementHash', type: 'bytes32' },
//                 { name: 'contractAddress', type: 'address' },
//                 { name: 'chainId', type: 'uint256' }
//             ]
//         };

//         const values = {
//             agreementHash: agreementHash,
//             contractAddress: await contract.getAddress(),
//             chainId: (await ethers.provider.getNetwork()).chainId
//         };

//         return await signer.signTypedData(domain, types, values);
//     }
// });
