// const { expect } = require("chai");
// const { ethers } = require("hardhat");
// import { CrowdFunding } from "../typechain-types";

// describe("Presale Crowdfunding", function () {
//  // let CrowdFunding, SecurityToken, USDC, EnergyToken;
//   //let crowdfunding, securityToken, usdc, energyToken;
//   let admin, client, investor1, investor2;
//   const targetAmount = ethers.utils.parseUnits("1000", 18);
//   const pledgeAmount = targetAmount;
//   const investment1 = ethers.utils.parseUnits("400", 18);
//   const investment2 = ethers.utils.parseUnits("600", 18);

//   beforeEach(async function () {
//     [admin, client, investor1, investor2] = await ethers.getSigners();

//     // Deploy mock USDC and security tokens
//     const Token = await ethers.getContractFactory("ERC20Mock");
//     usdc = await Token.deploy("USD Coin", "USDC", 18);
//     securityToken = await Token.deploy("Security Token", "STK", 18);
//     energyToken = await Token.deploy("Energy Token", "ENG", 18);

//     await usdc.deployed();
//     await securityToken.deployed();
//     await energyToken.deployed();

//     // Deploy Crowdfunding Contract
//     const CrowdfundingContract = await ethers.getContractFactory("CrowdFunding");
//     crowdfunding = await CrowdfundingContract.deploy(
//       targetAmount,
//       securityToken.address,
//       usdc.address,
//       energyToken.address,
//       client.address
//     );
//     await crowdfunding.deployed();

//     // Mint and approve tokens
//     await securityToken.mint(client.address, pledgeAmount);
//     await usdc.mint(investor1.address, investment1);
//     await usdc.mint(investor2.address, investment2);

//     await securityToken.connect(client).approve(crowdfunding.address, pledgeAmount);
//     await usdc.connect(investor1).approve(crowdfunding.address, investment1);
//     await usdc.connect(investor2).approve(crowdfunding.address, investment2);
//   });

//   it("Client pledges security tokens and receives EnergyTokens", async function () {
//     await crowdfunding.connect(client).pledgeSecurityToken(pledgeAmount);
//     expect(await energyToken.balanceOf(crowdfunding.address)).to.equal(pledgeAmount);
//   });

//   it("Investors invest and receive EnergyTokens", async function () {
//     await crowdfunding.connect(client).pledgeSecurityToken(pledgeAmount);

//     await crowdfunding.connect(investor1).invest(investment1);
//     await crowdfunding.connect(investor2).invest(investment2);

//     expect(await usdc.balanceOf(crowdfunding.address)).to.equal(targetAmount);
//     expect(await crowdfunding.totalInvestment()).to.equal(targetAmount);
//     expect(await crowdfunding.investments(investor1.address)).to.equal(investment1);
//     expect(await crowdfunding.investments(investor2.address)).to.equal(investment2);
//   });

//   it("Investors claim EnergyTokens when target is met", async function () {
//     await crowdfunding.connect(client).pledgeSecurityToken(pledgeAmount);
//     await crowdfunding.connect(investor1).invest(investment1);
//     await crowdfunding.connect(investor2).invest(investment2);

//     await crowdfunding.connect(admin).finalizeFundraising();

//     await crowdfunding.connect(investor1).claimTokens();
//     await crowdfunding.connect(investor2).claimTokens();

//     expect(await energyToken.balanceOf(investor1.address)).to.equal(investment1);
//     expect(await energyToken.balanceOf(investor2.address)).to.equal(investment2);
//   });

//   it("Investors can withdraw funds if target is not met", async function () {
//     await crowdfunding.connect(client).pledgeSecurityToken(pledgeAmount);
//     await crowdfunding.connect(investor1).invest(investment1);

//     await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Simulate deadline pass
//     await ethers.provider.send("evm_mine");

//     await crowdfunding.connect(investor1).withdrawInvestment();
//     expect(await usdc.balanceOf(investor1.address)).to.equal(investment1);
//   });

//   it("Client can withdraw security tokens if fundraising fails", async function () {
//     await crowdfunding.connect(client).pledgeSecurityToken(pledgeAmount);
//     await crowdfunding.connect(investor1).invest(investment1);

//     await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Simulate deadline pass
//     await ethers.provider.send("evm_mine");

//     await crowdfunding.connect(client).withdrawSecurityToken();
//     expect(await securityToken.balanceOf(client.address)).to.equal(pledgeAmount);
//   });
// });
