import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat";

const checkInvestment = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre;

  // Get signers instead of using hardcoded addresses
  const signers = await ethers.getSigners();
  const deploySigner = signers[0]; // Use the first signer as the deployer for everything
  const clientSigner = signers[1];
  const auditorSigner = signers[2];
  const generalContractorSigner = signers[3];

  // Log the addresses of the signers for debugging
  console.log(`Deployer Address: ${deploySigner.address}`);
  console.log(`Client Address: ${clientSigner.address}`);
  console.log(`Auditor Address: ${auditorSigner.address}`);
  console.log(`General Contractor Address: ${generalContractorSigner.address}`);

  // Fetch contract addresses dynamically from deployments
  const securityAddress = (await deployments.get("SecurityToken")).address;
  const utilityAddress = (await deployments.get("UtilityToken")).address;
  const crowdFundingAddress = (await deployments.get("CrowdFunding")).address;
  const energyAddress = (await deployments.get("EnergyToken")).address;

  // Fetching deployed contract instances
  const securityToken = await ethers.getContractAt("SecurityToken", securityAddress);
  const utilityToken = await ethers.getContractAt("UtilityToken", utilityAddress);
  const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingAddress);
  const energyToken = await ethers.getContractAt("EnergyToken", energyAddress);

  console.log("=== Starting CrowdFunding Investment Process ===");

  // Step 1: Client pledges SecurityTokens to ensure sufficient funds for all investors
  console.log("\n--- Step 1: Client Pledges SecurityTokens ---");

  const proposal = await crowdFunding.proposal();
  const targetAmount = proposal.targetAmount;

  console.log(`Target funding amount: ${ethers.formatUnits(targetAmount, 18)} tokens`);

  const approvalAmount = targetAmount;

  // Verify if client has enough security tokens to pledge
  const clientSecurityBalance = await securityToken.balanceOf(clientSigner.address);
  console.log(`Client's current security token balance: ${ethers.formatUnits(clientSecurityBalance, 18)} tokens`);

  if (clientSecurityBalance < approvalAmount) {
    console.log(
      `Warning: Client does not have sufficient security tokens. Has ${ethers.formatUnits(clientSecurityBalance, 18)}, needs ${ethers.formatUnits(approvalAmount, 18)}`,
    );
  }

  // Client approves the required amount to be pledged
  await securityToken.connect(clientSigner).approve(crowdFundingAddress, approvalAmount);
  console.log(`✅ Approved ${ethers.formatUnits(approvalAmount, 18)} SecurityTokens for the CrowdFunding contract`);

  await crowdFunding.connect(clientSigner).pledgeTokens(approvalAmount);
  console.log("✅ Tokens pledged successfully");

  // Check if energy tokens are correctly updated
  const contractEnergyBalance = await energyToken.balanceOf(crowdFundingAddress);
  console.log(`Contract's energy token balance after pledge: ${ethers.formatUnits(contractEnergyBalance, 18)} tokens`);

  // Step 2: Prepare investors with UtilityTokens for investment
  console.log("\n--- Step 2: Prepare Investors with UtilityTokens ---");

  const investorAmount = ethers.parseUnits("300", 18);
  await utilityToken.connect(auditorSigner).transfer(generalContractorSigner.address, investorAmount);
  console.log(`✅ Transferred ${ethers.formatUnits(investorAmount, 18)} UtilityTokens to General Contractor`);

  await utilityToken.connect(auditorSigner).transfer(clientSigner.address, investorAmount);
  console.log(`✅ Transferred ${ethers.formatUnits(investorAmount, 18)} UtilityTokens to Client`);

  // Step 3: Investors approve the contract to spend their UtilityTokens
  console.log("\n--- Step 3: Investors Approve UtilityTokens ---");

  const investorApprovalAmount = ethers.parseUnits("100", 18); // Example investment amount

  await utilityToken.connect(clientSigner).approve(crowdFundingAddress, investorApprovalAmount);
  console.log(`✅ Client approved ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens for investment`);

  await utilityToken.connect(generalContractorSigner).approve(crowdFundingAddress, investorApprovalAmount);
  console.log(
    `✅ General Contractor approved ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens for investment`,
  );

  // Step 4: Investors pledge their UtilityTokens to the CrowdFunding contract
  console.log("\n--- Step 4: Investors Pledge UtilityTokens ---");

  await crowdFunding.connect(clientSigner).invest(investorApprovalAmount);
  console.log(`✅ Client pledged ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens`);

  await crowdFunding.connect(generalContractorSigner).invest(investorApprovalAmount);
  console.log(`✅ General Contractor pledged ${ethers.formatUnits(investorApprovalAmount, 18)} UtilityTokens`);

  // Step 5: Check contract's final balance of UtilityTokens
  const contractUtilityBalance = await utilityToken.balanceOf(crowdFundingAddress);
  console.log(`Contract's final UtilityToken balance: ${ethers.formatUnits(contractUtilityBalance, 18)} tokens`);

  console.log("=== Investment Process Completed ===");
};

const main = async () => {
  await checkInvestment(hre);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});

// //-----------------------------------------------------------------------

// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";

// const checkInvestment: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { ethers } = hre;

//   // Client and Investor address
//   const clientAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
//   const investorAddress = "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec"; // Example investor address
//   const auditorAddress = "0x71bE63f3384f5fb98995898A86B02Fb2426c5788";
//   //const gcAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // General contractor address
//   const securityAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
//   const utilityAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
//   const crowdFundingAddress = "0xBC9129Dc0487fc2E169941C75aABC539f208fb01";
//   const energyAddress = "0x663F3ad617193148711d28f5334eE4Ed07016602";

//   // Get deployed contracts
//   const securityToken = await ethers.getContractAt("SecurityToken", securityAddress);
//   const utilityToken = await ethers.getContractAt("UtilityToken", utilityAddress);
//   const crowdFunding = await ethers.getContractAt("CrowdFunding", crowdFundingAddress);
//   const energyToken = await ethers.getContractAt("EnergyToken", energyAddress);

//   // Get signers
//   const clientSigner = await ethers.getSigner(clientAddress);
//   const investorSigner = await ethers.getSigner(investorAddress);
//   const auditorSigner = await ethers.getSigner(auditorAddress);
//   const investorSigner2 = await ethers.getSigner("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"); // Another investor

//   console.log("=== Starting CrowdFunding Check ===");

//   // Step 1: Client pledges SecurityTokens - ensure enough for all investors
//   console.log("\n--- Step 1: Client pledges SecurityTokens ---");
//   // Get target amount from contract to determine how many security tokens to pledge
//   const proposal = await crowdFunding.proposal();
//   const targetAmount = proposal.targetAmount;
//   console.log(`Target funding amount: ${ethers.formatUnits(targetAmount, 18)}`);

//   // Ensure we pledge at least as many tokens as the target funding amount
//   const approvalAmount = targetAmount;

//   // Check client's security token balance
//   const clientSecurityBalance = await securityToken.balanceOf(clientAddress);
//   console.log(`Client security token balance: ${ethers.formatUnits(clientSecurityBalance, 18)}`);

//   if (clientSecurityBalance < approvalAmount) {
//     console.log(
//       `Warning: Client has insufficient security tokens. Has ${ethers.formatUnits(clientSecurityBalance, 18)}, needs ${ethers.formatUnits(approvalAmount, 18)}`,
//     );
//   }

//   await securityToken.connect(clientSigner).approve(crowdFundingAddress, approvalAmount);
//   console.log(`✅ SecurityToken approved for CrowdFunding contract: ${ethers.formatUnits(approvalAmount, 18)} tokens`);

//   await crowdFunding.connect(clientSigner).pledgeTokens(approvalAmount);
//   console.log("✅ Tokens pledged successfully");

//   // Check energy token balance of contract after pledge
//   const contractEnergyBalance = await energyToken.balanceOf(crowdFundingAddress);
//   console.log(`Contract energy token balance after pledge: ${ethers.formatUnits(contractEnergyBalance, 18)}`);

//   // Step 2: Prepare investors with UtilityTokens
//   console.log("\n--- Step 2: Prepare investors with UtilityTokens ---");

//   // Transfer utility tokens to investors (smaller amounts for testing)
//   const investorAmount = ethers.parseUnits("300", 18);
//   await utilityToken.connect(auditorSigner).transfer(investorAddress, investorAmount);
//   console.log(`✅ Transferred ${ethers.formatUnits(investorAmount, 18)} UtilityTokens to investor 1`);

//   // For testing, let's make the second investment smaller
//   const investor2Amount = ethers.parseUnits("800", 18);
//   await utilityToken.connect(auditorSigner).transfer(investorSigner2.address, investor2Amount);
//   console.log(`✅ Transferred ${ethers.formatUnits(investor2Amount, 18)} UtilityTokens to investor 2`);

//   // Step 3: First investor makes partial investment
//   console.log("\n--- Step 3: First investor makes partial investment ---");
//   await utilityToken.connect(investorSigner).approve(crowdFundingAddress, investorAmount);
//   console.log("✅ Investor 1 approved UtilityTokens");

//   await crowdFunding.connect(investorSigner).invest(investorAmount);
//   console.log("✅ Investor 1 investment successful");

//   // Check funding status
//   let fundsRaised = await crowdFunding.fundsRaised();
//   console.log(`Funds raised after first investment: ${ethers.formatUnits(fundsRaised, 18)}`);

//   let fundingStatus = await crowdFunding.fundingSuccessful();
//   console.log(`Funding status after first investment: ${fundingStatus ? "Successful" : "Not yet successful"}`);

//   // Step 4: Modify contract state for testing if needed
//   // For testing purposes, we can simulate that funding is successful
//   // This might require a special function in the contract or direct state modification in a test environment
//   console.log("\n--- Step 4: Second investor invests ---");

//   await utilityToken.connect(investorSigner2).approve(crowdFundingAddress, investor2Amount);
//   console.log("✅ Investor 2 approved UtilityTokens");

//   try {
//     // If target amount is very high, we may need to make the contract think funding is successful
//     // This is a test-only approach - in production, we would need to meet the actual target
//     if (targetAmount > fundsRaised + investor2Amount) {
//       console.log(`Note: Target amount (${ethers.formatUnits(targetAmount, 18)}) is higher than what we're investing.`);
//       console.log("In a real scenario, the funding target would need to be met.");

//       // For testing, we'll still proceed with the smaller investment
//     }

//     const investTx = await crowdFunding.connect(investorSigner2).invest(investor2Amount);
//     await investTx.wait();
//     console.log("✅ Investor 2 investment successful");

//     // Update funds raised
//     fundsRaised = await crowdFunding.fundsRaised();
//     console.log(`Total funds raised: ${ethers.formatUnits(fundsRaised, 18)}`);
//   } catch (error) {
//     console.log("Error during investment. This might be expected if we're not meeting the target amount.");
//     console.log(error);
//   }

//   // Check funding status again
//   fundingStatus = await crowdFunding.fundingSuccessful();
//   console.log(`Funding status after second investment: ${fundingStatus ? "Successful" : "Not yet successful"}`);

//   if (!fundingStatus) {
//     console.log("Funding not successful. Forcing contract state for testing purposes...");
//     // This would require a special function in the contract for testing
//     // In a real deployment, we would need to meet the actual funding target
//   }

//   // Check if energy tokens are released
//   const energyTokensReleased = await crowdFunding.energyTokensReleased();
//   console.log(`Energy tokens released: ${energyTokensReleased ? "Yes" : "No"}`);

//   // Step 5: Investors claim their EnergyTokens only if funding was successful
//   if (fundingStatus && energyTokensReleased) {
//     console.log("\n--- Step 5: Investors claim their EnergyTokens ---");

//     // Check contract's energy token balance before claims
//     const contractBalance = await energyToken.balanceOf(crowdFundingAddress);
//     console.log(`Contract's energy token balance before claims: ${ethers.formatUnits(contractBalance, 18)}`);

//     // Check pending energy tokens
//     const pending1 = await crowdFunding.pendingEnergyTokens(investorAddress);
//     console.log(`Investor 1 pending EnergyTokens: ${ethers.formatUnits(pending1, 18)}`);

//     try {
//       // Only claim if there are pending tokens and contract has enough balance
//       if (pending1 > 0 && contractBalance >= pending1) {
//         const claimTx1 = await crowdFunding.connect(investorSigner).claimEnergyTokens();
//         await claimTx1.wait();
//         console.log("✅ Investor 1 claimed EnergyTokens");

//         // Check investor 1's balance
//         const balance1 = await energyToken.balanceOf(investorAddress);
//         console.log(`Investor 1 EnergyToken balance: ${ethers.formatUnits(balance1, 18)}`);
//       } else {
//         console.log("Skipping claim for investor 1 - insufficient tokens or nothing to claim");
//       }
//     } catch (error) {
//       console.log("Error claiming tokens for investor 1:", error);
//     }

//     // Update contract balance
//     const contractBalanceAfter1 = await energyToken.balanceOf(crowdFundingAddress);
//     console.log(`Contract's energy token balance after first claim: ${ethers.formatUnits(contractBalanceAfter1, 18)}`);

//     // Investor 2 claims tokens
//     const pending2 = await crowdFunding.pendingEnergyTokens(investorSigner2.address);
//     console.log(`Investor 2 pending EnergyTokens: ${ethers.formatUnits(pending2, 18)}`);

//     try {
//       // Only claim if there are pending tokens and contract has enough balance
//       if (pending2 > 0 && contractBalanceAfter1 >= pending2) {
//         const claimTx2 = await crowdFunding.connect(investorSigner2).claimEnergyTokens();
//         await claimTx2.wait();
//         console.log("✅ Investor 2 claimed EnergyTokens");

//         // Check investor 2's balance
//         const balance2 = await energyToken.balanceOf(investorSigner2.address);
//         console.log(`Investor 2 EnergyToken balance: ${ethers.formatUnits(balance2, 18)}`);
//       } else {
//         console.log("Skipping claim for investor 2 - insufficient tokens or nothing to claim");
//         console.log(
//           `Contract has ${ethers.formatUnits(contractBalanceAfter1, 18)} tokens, investor 2 needs ${ethers.formatUnits(pending2, 18)}`,
//         );
//       }
//     } catch (error) {
//       console.log("Error claiming tokens for investor 2:", error);
//     }
//   } else {
//     console.log("\nSkipping token claims as funding was not successful or tokens were not released");
//   }

//   console.log("\n=== CrowdFunding Check Complete ===");
// };

// export default checkInvestment;
// checkInvestment.tags = ["check"];
