//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./SecurityToken.sol";
import "./IEnergyToken.sol";

/**
 * @title CrowdFunding
 * @dev A contract for managing CrowdFunding for infrastructure projects with milestone-based releases
 * and DAO voting for extra fund requests
 */
contract CrowdFunding is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IEnergyToken;
    using ECDSA for bytes32;

    enum FundingStatus { Active, Successful, Failed }
    FundingStatus public fundingStatus;

    struct Proposal {
        uint256 investmentPeriod;
        uint256 targetAmount;
    }

    struct Milestone {
        uint256 amount;
        bool verified;
        bool fundsReleased;
    }

    struct ExtraFundRequest {
        bytes32 proposalHash;
        uint256 amount;
        string description;
        uint256 createdAt;
        bool auditorApproved;
        uint256 votingEndTime;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
    }

    // Immutable state variables
    address public immutable auditor;
    address public immutable generalContractor;
    address public immutable client;
    IERC20 public immutable securityToken;
    IERC20 public immutable utilityToken;
    IEnergyToken public energyToken;

    // State variables
    Proposal public proposal;
    uint256 public constant MAX_VOTING_PERIOD = 7 days;//CheckWithIman*****************
    uint256 public constant MAX_DESCRIPTION_LENGTH = 256; // Limit to 256 characters
    bool public isFinalMilestoneAchieved;



    Milestone[] public milestones;
    ExtraFundRequest[] public extraFundRequests;
    
    mapping(address => uint256) public investorBalances;
    mapping(address => uint256) public pendingEnergyTokens;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public hasWithdrawnRefund;
    
    uint256 public fundsRaised;
    uint256 public constant VOTING_PERIOD = 7 days;
    
    // Status flags
    bool public tokensPledged;
    bool public securityTokensWithdrawn;
    bool public gcAgreement;
    bool public emergencyStop;
    bool public energyTokensReleased;
    
    // Domain separator for signatures
    bytes32 public immutable DOMAIN_SEPARATOR;

    // Events
    event InvestmentReceived(address indexed investor, uint256 amount);
    event FundingSuccessful();
    event FundingFailed();
    event TokensPledged(address indexed pledger, uint256 amount);
    event MilestoneVerified(uint256 indexed milestoneIndex);
    event FundsWithdrawn(uint256 indexed milestoneIndex, uint256 amount);
    event EmergencyToggled(bool stopped);
    event AgreementSigned(address indexed generalContractor);
    event EnergyTokensReleased();
    event ExtraFundRequestCreated(uint256 indexed requestId, bytes32 proposalHash, uint256 amount, string description);
    event ExtraFundRequestApproved(uint256 indexed requestId,uint256 indexed votingDuration);
    event ExtraFundRequestRejected(uint256 indexed requestId);
    event ExtraFundVoteCast(uint256 indexed requestId, address indexed voter, bool support, uint256 stake);
    event ExtraFundRequestExecuted(uint256 indexed requestId, bool approved);
    event RefundClaimed(address indexed investor, uint256 amount);
    event SecurityTokensWithdrawn(address indexed generalContractor, uint256 amount);
    event EnergyTokensClaimed(address indexed investor, uint256 amount);
    event FinalMilestoneAchieved();
    event EnergyCreditsVerified(address investor, uint creditsEarned);


    modifier notStopped() {
        require(!emergencyStop, "Contract is in emergency stop");
        _;
    }

    modifier onlyAuditor() {
        require(msg.sender == auditor, "Only auditor can call this function");
        _;
    }

    modifier onlyGeneralContractor() {
        require(msg.sender == generalContractor, "Only general contractor can call this function");
        _;
    }

    modifier onlyClient() {
        require(msg.sender == client, "Only client can call this function");
        _;
    }

    constructor(
        address _securityToken,
        address _utilityToken,
        address _energyToken,
        uint256 _investmentPeriod,
        uint256 _targetAmount,
        address _auditor,
        address _generalContractor,
        address _client,
        uint256[] memory _milestoneAmounts
    ) Ownable(msg.sender) {
        require(_securityToken != address(0), "Security token cannot be zero address");
        require(_utilityToken != address(0), "Utility token cannot be zero address");
        require(_energyToken != address(0), "Energy token cannot be zero address");
        require(_auditor != address(0), "Auditor cannot be zero address");
        require(_generalContractor != address(0), "General contractor cannot be zero address");
        require(_client != address(0), "Client cannot be zero address");
        require(_investmentPeriod > block.timestamp, "Investment period must be in the future");
        require(_targetAmount > 0, "Target amount must be greater than zero");
        require(_milestoneAmounts.length > 0, "Must have at least one milestone");

        securityToken = IERC20(_securityToken);
        utilityToken = IERC20(_utilityToken);
        energyToken = IEnergyToken(_energyToken);
        proposal = Proposal({investmentPeriod: _investmentPeriod, targetAmount: _targetAmount});
        auditor = _auditor;
        generalContractor = _generalContractor;
        client = _client;
        fundingStatus = FundingStatus.Active;

        
        // Validate milestone amounts total
        uint256 totalMilestoneAmount = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be greater than zero");
            totalMilestoneAmount += _milestoneAmounts[i];
            milestones.push(Milestone({
                amount: _milestoneAmounts[i], 
                verified: false, 
                fundsReleased: false
            }));
        }
        require(totalMilestoneAmount == _targetAmount, "Milestone amounts must sum to target amount");
        
        // Create domain separator for signatures
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("CrowdFunding")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Toggle the emergency stop state
     * @return bool New emergency stop state
     */
    function toggleEmergencyStop() external onlyOwner returns (bool) {
        emergencyStop = !emergencyStop;
        emit EmergencyToggled(emergencyStop);
        return emergencyStop;
    }

    /**
     * @dev Pledge security tokens to the contract (done by general contractor)
     * @param amount Amount of security tokens to pledge
     */
    

// Pledge tokens function
    function pledgeTokens(uint256 amount) external {
        require(msg.sender == client, "Only the client can pledge tokens");
        require(amount > 0, "Pledge amount must be greater than zero");
        require(securityToken.allowance(client, address(this)) >= amount, "Allowance too low");

        securityToken.safeTransferFrom(client, address(this), amount);
        energyToken.mint(address(this), amount);
        tokensPledged = true;

        emit TokensPledged(client, amount);
    }

function invest(uint256 amount) external nonReentrant notStopped returns (bool success) {
    // Validate investment amount and conditions
    require(amount > 0, "INVEST: Amount must be greater than zero");
    require(tokensPledged, "INVEST: Security tokens not pledged");
    require(block.timestamp <= proposal.investmentPeriod, "INVEST: Investment period has ended");
    require(fundingStatus == FundingStatus.Active, "INVEST: Funding is not active");

    // Check if the target amount will be exceeded
    uint256 newTotalRaised = fundsRaised + amount;
    require(newTotalRaised <= proposal.targetAmount, "INVEST: Funding target exceeded");

    // Ensure the user has sufficient balance and allowance
    require(utilityToken.allowance(msg.sender, address(this)) >= amount, "INVEST: Insufficient allowance");
    require(utilityToken.balanceOf(msg.sender) >= amount, "INVEST: Insufficient balance");

    // Update contract state before making external calls (gas optimization)
    investorBalances[msg.sender] += amount;
    fundsRaised = newTotalRaised;
    pendingEnergyTokens[msg.sender] += amount;

    // Transfer the tokens to the contract (use SafeERC20 for added safety)
    utilityToken.safeTransferFrom(msg.sender, address(this), amount);

    // Emit event for investment received
    emit InvestmentReceived(msg.sender, amount);

    // After every investment, check if funding period has ended and update status if necessary
    updateFundingStatus();

    // Check if the funding goal is reached and release energy tokens automatically
    if (newTotalRaised >= proposal.targetAmount) {
        fundingStatus = FundingStatus.Successful;
        emit FundingSuccessful();

        // Automatically release energy tokens to all investors
        _releaseEnergyTokens();
    }

    return true;
}

/**
 * @dev Internal function to release energy tokens when funding is successful
 */
function _releaseEnergyTokens() internal {
    require(fundingStatus == FundingStatus.Successful, "Funding must be successful to release tokens");
    require(!energyTokensReleased, "Energy tokens already released");
    
    // Mark tokens as released
    energyTokensReleased = true;
    
    // Emit event for energy tokens released
    emit EnergyTokensReleased();
}


function updateFundingStatus() internal {
    // Check if the funding deadline has passed
    if (block.timestamp >= proposal.investmentPeriod && fundingStatus == FundingStatus.Active) {
        // If the target was not met, mark the funding as failed
        if (fundsRaised < proposal.targetAmount) {
            fundingStatus = FundingStatus.Failed;
            emit FundingFailed();  // Emit event to signal that funding failed
        }
    }
}

/**
 * @dev Allow investors to claim their energy tokens
 * @return bool Success of the claim
 */
function claimEnergyTokens() external nonReentrant returns (bool) {
    require(fundingStatus == FundingStatus.Successful, "Funding must be successful to claim tokens");
    require(energyTokensReleased, "Energy tokens not yet released");
    require(pendingEnergyTokens[msg.sender] > 0, "No energy tokens to claim");
    
    uint256 amount = pendingEnergyTokens[msg.sender];
    pendingEnergyTokens[msg.sender] = 0;
    
    // Transfer energy tokens to the investor
    energyToken.transfer(msg.sender, amount);
    
    emit EnergyTokensClaimed(msg.sender, amount);
    
    return true;
}

/**
 * @dev Claim refund if funding failed
 */
function claimRefund() external nonReentrant {
    // Check or update funding status    
    require(fundingStatus == FundingStatus.Failed, "Funding has not failed");
    require(investorBalances[msg.sender] > 0, "No investment to refund");
    require(!hasWithdrawnRefund[msg.sender], "Refund already claimed");
    
    uint256 amount = investorBalances[msg.sender];
    hasWithdrawnRefund[msg.sender] = true;
    
    utilityToken.safeTransfer(msg.sender, amount);
    emit RefundClaimed(msg.sender, amount);
}


/**
 * @dev Sign agreement with a signature to prevent replay attacks
 * @param agreementHash Hash of the agreement
 * @param signature Signature of the agreement
 *
 * Note:
 * In the future, off-chain signature verification can be done using a backend service.
 * The backend will be responsible for verifying the signature using the same EIP-712
 * compliant message structure and comparing the recovered signer address with the 
 * expected signer (e.g., generalContractor). This will prevent replay attacks 
 * by ensuring the validity of the signature before interacting with the contract.
 */
function signAgreement(bytes32 agreementHash, bytes calldata signature) external nonReentrant notStopped onlyGeneralContractor {
    require(!gcAgreement, "Already signed");
    require(fundingStatus == FundingStatus.Successful, "Funding must be successful first");
    
    // Create EIP-712 compliant message
    bytes32 digest = keccak256(
        abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(abi.encode(agreementHash, address(this), block.chainid))
        )
    );
    
    address signer = ECDSA.recover(digest, signature);
    require(signer == generalContractor, "Invalid signature");

    gcAgreement = true;
    emit AgreementSigned(generalContractor);
}

/**
 * @dev Verify a milestone completion
 * @param milestoneIndex Index of the milestone to verify
 */
function verifyMilestone(uint256 milestoneIndex) external nonReentrant notStopped onlyAuditor {
    require(fundingStatus == FundingStatus.Successful, "Funding must be successful first");
    require(gcAgreement, "General contractor must sign agreement first");
    require(milestoneIndex < milestones.length, "Invalid milestone index");
    
    // Check if the milestone is already verified before doing any state changes
    if (milestones[milestoneIndex].verified) {
        revert("Milestone already verified");
    }

    milestones[milestoneIndex].verified = true;
    emit MilestoneVerified(milestoneIndex);

    // Check if the milestone is the last one
    if (milestoneIndex == milestones.length - 1) {
        isFinalMilestoneAchieved = true;  // Mark final milestone as achieved
        emit FinalMilestoneAchieved();   // Emit event to notify that the final milestone is achieved

        // Trigger any additional logic such as notifying investors or triggering the token redemption process
        // For example, you can call functions to allow investors to burn tokens or redeem credits here.
    }
    

}

    /**
 * @dev Withdraw funds for completed milestone
 * @param milestoneIndex Index of the verified milestone
 */
function withdrawByGC(uint256 milestoneIndex) external nonReentrant notStopped onlyGeneralContractor {
    require(milestoneIndex < milestones.length, "Invalid milestone index");
    require(milestones[milestoneIndex].verified, "Milestone not verified");
    require(!milestones[milestoneIndex].fundsReleased, "Funds already released");

    uint256 amount = milestones[milestoneIndex].amount;
    
    // Ensure that the amount is greater than zero before attempting a transfer
    require(amount > 0, "Amount must be greater than zero");

    // Update state before transfer to ensure safety
    milestones[milestoneIndex].fundsReleased = true;
    
    // Transfer funds
    utilityToken.safeTransfer(generalContractor, amount);
    
    // Emit event after successful transfer
    emit FundsWithdrawn(milestoneIndex, amount);
}

function requestExtraFunds(
    bytes32 proposalHash, 
    uint256 amount, 
    string calldata description
) external nonReentrant notStopped onlyGeneralContractor {
    require(fundingStatus == FundingStatus.Successful, "Funding must be successful first");
    require(gcAgreement, "General contractor must sign agreement first");
    require(amount > 0, "Amount must be greater than zero");
    require(bytes(description).length <= MAX_DESCRIPTION_LENGTH, "Description too long");

    uint256 requestId = extraFundRequests.length;

    extraFundRequests.push(ExtraFundRequest({
        proposalHash: proposalHash,
        amount: amount,
        description: description,
        createdAt: block.timestamp,
        auditorApproved: false,
        votingEndTime: 0,
        votesFor: 0,
        votesAgainst: 0,
        executed: false
    }));

    emit ExtraFundRequestCreated(requestId, proposalHash, amount, description);
}

    /**
     * @dev Approve extra fund request and open it for voting
     * @param requestId ID of the extra fund request
     * @param votingDuration Duration for the voting period
     */
    function approveExtraFundRequest(uint256 requestId, uint256 votingDuration) external nonReentrant notStopped onlyAuditor {
        require(requestId < extraFundRequests.length, "Invalid request ID");
        require(votingDuration <= MAX_VOTING_PERIOD, "Voting period too long");
        
        ExtraFundRequest storage request = extraFundRequests[requestId];
        
        require(!request.auditorApproved, "Request already approved");
        require(!request.executed, "Request already executed");
        
        request.auditorApproved = true;
        request.votingEndTime = block.timestamp + votingDuration;
        
        emit ExtraFundRequestApproved(requestId, votingDuration);
    }


/**
 * @dev Allows investors to vote on an extra fund request.
 * @param requestId The ID of the extra fund request.
 * @param support True to vote in favor, false to vote against.
 */
/**
 * @dev Allows investors to vote on an extra fund request.
 * @param requestId The ID of the extra fund request.
 * @param support True to vote in favor, false to vote against.
 */
function voteOnExtraFundRequest(uint256 requestId, bool support) external nonReentrant notStopped {
    require(requestId < extraFundRequests.length, "Invalid request ID");

    uint256 voterBalance = investorBalances[msg.sender];
    require(voterBalance > 0, "Only investors with stake can vote");

    ExtraFundRequest storage request = extraFundRequests[requestId];

    require(request.auditorApproved, "Request not approved by auditor");
    require(request.votingEndTime > 0, "Voting period not started");
    require(block.timestamp < request.votingEndTime, "Voting period ended");
    require(!request.executed, "Request already executed");
    require(!hasVoted[requestId][msg.sender], "Already voted");

    // Mark voter as having voted
    hasVoted[requestId][msg.sender] = true;

    // Increase vote count based on stake
    if (support) {
        request.votesFor += voterBalance;
    } else {
        request.votesAgainst += voterBalance;
    }

    emit ExtraFundVoteCast(requestId, msg.sender, support, voterBalance);
}


function executeExtraFundRequest(uint256 requestId) external nonReentrant notStopped onlyAuditor {
    require(requestId < extraFundRequests.length, "Invalid request ID");
    
    ExtraFundRequest storage request = extraFundRequests[requestId];
    require(request.auditorApproved, "Request not approved by auditor");
    require(block.timestamp >= request.votingEndTime, "Voting period not ended");
    require(!request.executed, "Request already executed");

    uint256 totalVotes = request.votesFor + request.votesAgainst;
    uint256 quorum = (totalVotes * 60) / 100; // 60% quorum**********************************Ask Iman

    require(totalVotes >= quorum, "Quorum not met");

    bool approved = request.votesFor > request.votesAgainst;

    // If the request is approved, transfer the funds to the contractor
    if (approved) {
        request.executed = true;
        utilityToken.safeTransfer(generalContractor, request.amount);
        emit ExtraFundRequestExecuted(requestId, approved);
    } else {
        // If the request is rejected, emit a rejection event
        emit ExtraFundRequestRejected(requestId);
    }
}


// Mapping to track individual investor energy credit redemptions
mapping(address => EnergyCreditRedemption) public energyCreditRedemptions;

// Events for final milestone and energy credit processes
event EnergyTokensBurned(address indexed investor, uint256 amount);
event EnergyCreditsClaimed(address indexed investor, uint256 credits);

// Flag to track final milestone completion
bool public finalMilestoneAchieved;

// Track total burned tokens to prevent over-redemption
uint256 public totalTokensBurned;

// Energy credit conversion rate (settable by admin or oracle)
uint256 public energyCreditRate = 1; // Default 1:1 conversion

// External energy provider verification
address public energyProvider;

// Time limit for claiming energy credits after final milestone
uint256 public creditClaimDeadline;
uint256 public constant CLAIM_PERIOD = 30 days;
modifier onlyInvestor(address investor) {
    require(msg.sender == investor, "Not authorized");
    _;
}


/**
 * @dev Mark the final milestone as achieved and trigger investor notifications
 */
function completeFinalMilestone() external nonReentrant notStopped onlyAuditor {
    require(!finalMilestoneAchieved, "Final milestone already completed");
    require(milestones.length > 0, "No milestones exist");
    require(milestones[milestones.length - 1].verified, "Final milestone not verified");
    
    finalMilestoneAchieved = true;
    creditClaimDeadline = block.timestamp + CLAIM_PERIOD;
    emit FinalMilestoneAchieved();
}

// New struct to track the verification process
struct EnergyCreditRedemption {
    uint256 tokensBurned;
    uint256 creditsEarned;
    bool redeemed;
    bool verifiedByProvider;  // Track whether the energy provider has verified the redemption
}


// Set energy provider (owner can change it)
function setEnergyProvider(address provider) external onlyOwner {
    energyProvider = provider;
}

// Verify energy credit redemption
function verifyEnergyCreditRedemption(address investor) external {
    require(msg.sender == energyProvider, "Only energy provider can verify claims");
    
    EnergyCreditRedemption storage redemption = energyCreditRedemptions[investor];
    require(redemption.creditsEarned > 0, "No credits earned to verify");
    require(!redemption.verifiedByProvider, "Credits already verified");

    // Mark the redemption as verified by the provider
    redemption.verifiedByProvider = true;

    emit EnergyCreditsVerified(investor, redemption.creditsEarned);  // Emit an event to log verification
}

// The burn and claim function
function burnAndClaimEnergyCredits(uint256 amount) external nonReentrant {
    require(finalMilestoneAchieved, "Final milestone not yet achieved");
    require(amount > 0, "Burn amount must be greater than zero");
    require(energyToken.balanceOf(msg.sender) >= amount, "Insufficient energy tokens");
    require(energyToken.allowance(msg.sender, address(this)) >= amount, "Token allowance too low");

    // Calculate energy credits based on conversion rate
    uint256 energyCredits = amount * energyCreditRate;

    // Burn tokens
    energyToken.burnFrom(msg.sender, amount);

    // Track redemption
    energyCreditRedemptions[msg.sender] = EnergyCreditRedemption({
        tokensBurned: amount,
        creditsEarned: energyCredits,
        redeemed: false,  // Not redeemed yet
        verifiedByProvider: false  // Initially not verified
    });

    totalTokensBurned += amount;
    emit EnergyTokensBurned(msg.sender, amount);

    // Trigger the event for claiming credits (before verification)
    emit EnergyCreditsClaimed(msg.sender, energyCredits);
}


/**
 * @dev Get energy credit redemption details for an investor
 * @param investor Address of the investor
 * @return tokensBurned Amount of tokens burned
 * @return creditsEarned Number of energy credits earned
 * @return redeemed Whether credits have been redeemed
 * @return verified Whether credits have been verified by the energy provider
 */
function getEnergyCreditRedemptionDetails(address investor) external view onlyInvestor(investor) returns (
    uint256 tokensBurned,
    uint256 creditsEarned,
    bool redeemed,
    bool verified
) {
    EnergyCreditRedemption storage redemption = energyCreditRedemptions[investor];
    return (
        redemption.tokensBurned,
        redemption.creditsEarned,
        redemption.redeemed,
        redemption.verifiedByProvider  // Return the verification status as well
    );
}




//__________________________________________________________________________________________________________________
/**
 * @dev Get the total number of milestones in the contract
 * @return uint256 Total number of milestones
 */
function getMilestoneCount() external view returns (uint256) {
    return milestones.length;
}

/**
 * @dev Get details of a specific milestone
 * @param milestoneIndex The index of the milestone
 * @return amount The amount allocated for the milestone
 * @return verified Whether the milestone has been verified
 * @return fundsReleased Whether the funds for the milestone have been released
 */
function getMilestoneDetails(uint256 milestoneIndex) external view returns (
    uint256 amount,
    bool verified,
    bool fundsReleased
) {
    require(milestoneIndex < milestones.length, "Invalid milestone index");

    Milestone storage milestone = milestones[milestoneIndex];
    return (
        milestone.amount,
        milestone.verified,
        milestone.fundsReleased
    );
}

/**
 * @dev Get the total number of extra fund requests made
 * @return uint256 Total number of extra fund requests
 */
function getExtraFundRequestCount() external view returns (uint256) {
    return extraFundRequests.length;
}

/**
 * @dev Get the details of a specific extra fund request
 * @param requestId The ID of the extra fund request
 * @return proposalHash The hash of the proposal associated with the request
 * @return amount The requested amount for the extra fund
 * @return description A brief description of the extra fund request
 * @return auditorApproved Whether the request has been approved by the auditor
 * @return votingEndTime The timestamp when the voting period ends
 * @return votesFor The total number of votes in favor of the request
 * @return votesAgainst The total number of votes against the request
 * @return executed Whether the request has been executed (funds transferred)
 */
function getExtraFundRequestDetails(uint256 requestId) external view returns (
    bytes32 proposalHash,
    uint256 amount,
    string memory description,
    bool auditorApproved,
    uint256 votingEndTime,
    uint256 votesFor,
    uint256 votesAgainst,
    bool executed
) {
    require(requestId < extraFundRequests.length, "Invalid request ID");

    ExtraFundRequest storage request = extraFundRequests[requestId];

    return (
        request.proposalHash,
        request.amount,
        request.description,
        request.auditorApproved,
        request.votingEndTime,
        request.votesFor,
        request.votesAgainst,
        request.executed
    );
}

}