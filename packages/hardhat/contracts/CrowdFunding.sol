// SPDX-License-Identifier: MIT
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
 * and DAO voting for extra fund requests.
 */
contract CrowdFunding is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IEnergyToken;
    using ECDSA for bytes32;

    enum FundingStatus { Active, Successful, Failed }
    
    struct Proposal {
        uint256 investmentPeriod;
        uint256 targetAmount;
        uint256 platformFeePercentage; // Fee percentage (e.g., 5 for 5%)

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

    struct EnergyCreditRedemptions {
        uint256 tokensBurned;
        uint256 creditsEarned;
        bool redeemed;
        bool verifiedByProvider;
    }

    // Immutable state variables to save gas
    address public immutable auditor;
    address public immutable generalContractor;
    address public immutable client;
    IERC20 public immutable securityToken;
    IERC20 public immutable mockUSDC;
    IEnergyToken public immutable energyToken;
    uint256 public immutable CLAIM_PERIOD;
    address public immutable infraFundWallet;
    
    // Constants
    uint256 public constant MAX_VOTING_PERIOD = 7 days;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 256; // Limit to 256 characters
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant QUORUM_PERCENTAGE = 60; // Percentage needed for quorum

    // State variables
    FundingStatus public fundingStatus;
    Proposal public proposal;
    bytes32 public DOMAIN_SEPARATOR;
    uint256 public fundsRaised;
    bool public platformFeeWithdrawn;
    uint256 public totalTokensBurned;
    uint256 public energyCreditRate = 1; // Default 1:1 conversion
    address public energyProvider;
    uint256 public creditClaimDeadline;

    // Status flags - packed together to save gas
    bool public tokensPledged;
    bool public securityTokensWithdrawn;
    bool public gcAgreement;
    bool public emergencyStop;
    bool public energyTokensReleased;
    bool public finalMilestoneAchieved;

    // Collections
    Milestone[] public milestones;
    ExtraFundRequest[] public extraFundRequests;

    // Mappings
    mapping(address => uint256) public investorBalances;
    mapping(address => uint256) public pendingEnergyTokens;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public hasWithdrawnRefund;
    mapping(address => EnergyCreditRedemptions) public energyCreditRedemptions;

    // Events
    event InvestmentReceived(address indexed investor, uint256 amount);
    event FundingSuccessful();
    event FundingFailed();
    event TokensPledged(address indexed pledger, uint256 amount);
    event MilestoneVerified(uint256 indexed milestoneIndex);
    event FundsWithdrawn(uint256 indexed milestoneIndex, uint256 amount);
    event EmergencyToggled(bool stopped);
    event AgreementSigned(address indexed generalContractor);
    event PlatformFeeWithdrawn(uint256 amount);
    event EnergyTokensReleased();
    event ExtraFundRequestCreated(uint256 indexed requestId, bytes32 proposalHash, uint256 amount, string description);
    event ExtraFundRequestApproved(uint256 indexed requestId, uint256 indexed votingDuration);
    event ExtraFundRequestRejected(uint256 indexed requestId);
    event ExtraFundVoteCast(uint256 indexed requestId, address indexed voter, bool support, uint256 stake);
    event ExtraFundRequestExecuted(uint256 indexed requestId, bool approved);
    event RefundClaimed(address indexed investor, uint256 amount);
    event SecurityTokensWithdrawn(address indexed generalContractor, uint256 amount);
    event EnergyTokensClaimed(address indexed investor, uint256 amount);
    event FinalMilestoneAchieved();
    event EnergyCreditsVerified(address investor, uint creditsEarned);
    event EnergyTokensBurned(address indexed investor, uint256 amount);
    event EnergyCreditsClaimed(address indexed investor, uint256 credits);
    event EnergyProviderSet(address indexed provider);
    event EnergyCreditRateUpdated(uint256 newRate);

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
    
    modifier onlyEnergyProvider() {
        require(msg.sender == energyProvider, "Only energy provider can call this function");
        _;
    }

    /**
     * @dev Constructor that initializes all immutable variables
     */
    // Split initialization into constructor (for immutables) and initialize function

constructor(
    address _securityToken,
    address _mockUSDC,
    address _energyToken,
    address _auditor,
    address _generalContractor,
    address _client,
    uint256 _claimPeriod,
    address _infraFundWallet
) Ownable(msg.sender) {
    // Basic validations for immutable variables
    require(_securityToken != address(0), "Security token cannot be zero address");
    require(_mockUSDC != address(0), "Utility token cannot be zero address");
    require(_energyToken != address(0), "Energy token cannot be zero address");
    require(_auditor != address(0), "Auditor cannot be zero address");
    require(_generalContractor != address(0), "General contractor cannot be zero address");
    require(_client != address(0), "Client cannot be zero address");
    require(_infraFundWallet != address(0), "InfraFund wallet cannot be zero address");
 
    // Set immutable state variables
    securityToken = IERC20(_securityToken);
    mockUSDC = IERC20(_mockUSDC);
    energyToken = IEnergyToken(_energyToken);
    auditor = _auditor;
    generalContractor = _generalContractor;
    client = _client;
    CLAIM_PERIOD = _claimPeriod;
        infraFundWallet = _infraFundWallet;    
    // Initialize default values
    fundingStatus = FundingStatus.Active;
}

/**
 * @dev Initialize the remaining state variables and perform validations
 * @param _investmentPeriod The duration of the investment period
 * @param _targetAmount The funding target amount
 * @param _milestoneAmounts Array of milestone amounts
 */
function initialize(
    uint256 _investmentPeriod,
    uint256 _targetAmount,
    uint256[] memory _milestoneAmounts,
    uint256 _platformFeePercentage

) external onlyOwner {
    // Make sure initialize can only be called once
    require(DOMAIN_SEPARATOR == bytes32(0), "Already initialized");
    
    // Validate non-immutable parameters
    require(_investmentPeriod > block.timestamp, "Investment period must be in the future");
    require(_targetAmount > 0, "Target amount must be greater than zero");
    require(_milestoneAmounts.length > 0, "Must have at least one milestone");
    require(_platformFeePercentage <= 100, "Platform fee percentage must be <= 100");    
    
    // Set proposal
    proposal = Proposal({investmentPeriod: _investmentPeriod, targetAmount: _targetAmount, platformFeePercentage: _platformFeePercentage});
    
    // Initialize milestones
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
    require(totalMilestoneAmount <= _targetAmount, "Milestone amounts must not exceed target amount");
    
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
     * @dev Update the energy credit rate
     * @param newRate New rate for energy credit conversion
     */
    function setEnergyCreditRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be greater than zero");
        energyCreditRate = newRate;
        emit EnergyCreditRateUpdated(newRate);
    }

    /**
     * @dev Set energy provider (owner can change it)
     * @param provider Address of the energy provider
     */
    function setEnergyProvider(address provider) external onlyOwner {
        require(provider != address(0), "Provider cannot be zero address");
        energyProvider = provider;
        emit EnergyProviderSet(provider);
    }

    /**
     * @dev Pledge security tokens to the contract
     * @param amount Amount of security tokens to pledge
     */
    function pledgeTokens(uint256 amount) external onlyClient {
        require(amount > 0, "Pledge amount must be greater than zero");
        require(securityToken.allowance(client, address(this)) >= amount, "Allowance too low");

        securityToken.safeTransferFrom(client, address(this), amount);
        energyToken.mint(address(this), amount);
        tokensPledged = true;

        emit TokensPledged(client, amount);
    }

    /**
     * @dev Invest in the project
     * @param amount Amount to invest
     * @return success Indicates whether the investment was successful
     */
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
        require(mockUSDC.allowance(msg.sender, address(this)) >= amount, "INVEST: Insufficient allowance");
        require(mockUSDC.balanceOf(msg.sender) >= amount, "INVEST: Insufficient balance");

        // Update contract state before making external calls (gas optimization)
        investorBalances[msg.sender] += amount;
        fundsRaised = newTotalRaised;
        pendingEnergyTokens[msg.sender] += amount;

        // Transfer the tokens to the contract
        mockUSDC.safeTransferFrom(msg.sender, address(this), amount);

        // Emit event for investment received
        emit InvestmentReceived(msg.sender, amount);

        // Update funding status based on current conditions
        _updateFundingStatus();

        return true;
    }


 /**
 * @dev Updates the funding status based on raised amount and time, and emits an event when updated.
 */
function _updateFundingStatus() internal {
    require(fundingStatus == FundingStatus.Active, "Funding is no longer active");

    if (fundsRaised >= proposal.targetAmount) {
        fundingStatus = FundingStatus.Successful;
        emit FundingSuccessful();
        _releaseEnergyTokens(); // Automatically release energy tokens
        _withdrawPlatformFee();
    } else if (block.timestamp >= proposal.investmentPeriod) {
        fundingStatus = FundingStatus.Failed;
        emit FundingFailed();
    }
}

/** 
 * @dev External function to trigger the funding status update.
 * Can be called by anyone, but only works if the funding is still active.
 */
function updateFundingStatus() external {
    require(fundingStatus == FundingStatus.Active, "Funding is already finalized");
    _updateFundingStatus();
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
        
        // Transfer energy tokens to the investor using safeTransfer
        energyToken.safeTransfer(msg.sender, amount);
        
        emit EnergyTokensClaimed(msg.sender, amount);
        
        return true;
    }

    /**
     * @dev Claim refund if funding failed
     */
    function claimRefund() external nonReentrant {
        _updateFundingStatus(); // Ensure status is up to date
        require(fundingStatus == FundingStatus.Failed, "Funding has not failed");
        require(investorBalances[msg.sender] > 0, "No investment to refund");
        require(!hasWithdrawnRefund[msg.sender], "Refund already claimed");
        
        uint256 amount = investorBalances[msg.sender];
        hasWithdrawnRefund[msg.sender] = true;
        
        mockUSDC.safeTransfer(msg.sender, amount);
        emit RefundClaimed(msg.sender, amount);
    }

    /**
     * @dev Withdraw platform fee - can only be called when funding is successful
     */
    function _withdrawPlatformFee() internal nonReentrant {
        require(fundingStatus == FundingStatus.Successful, "Funding must be successful");
        require(!platformFeeWithdrawn, "Platform fee already withdrawn");
        
        platformFeeWithdrawn = true;
        
        uint256 feeAmount = (fundsRaised * proposal.platformFeePercentage) / 100;
        require(feeAmount > 0, "No platform fee to withdraw");
        
        mockUSDC.safeTransfer(infraFundWallet, feeAmount);
        emit PlatformFeeWithdrawn(feeAmount);
    }


    /**
 * @dev Allows the client to withdraw pledged security tokens if funding fails
 * @return bool Success of the withdrawal
 */
function withdrawSecurityTokens() external nonReentrant onlyClient returns (bool) {
    // Ensure funding has failed
    _updateFundingStatus(); // Ensure status is up to date
    require(fundingStatus == FundingStatus.Failed, "Funding has not failed");
    require(!securityTokensWithdrawn, "Security tokens already withdrawn");
    require(tokensPledged, "No tokens were pledged");
    
    securityTokensWithdrawn = true;
    
    uint256 securityTokenBalance = securityToken.balanceOf(address(this));
    require(securityTokenBalance > 0, "No security tokens to withdraw");
   
    securityToken.safeTransfer(client, securityTokenBalance);
    
    emit SecurityTokensWithdrawn(client, securityTokenBalance);
    
    return true;
}

    /**
     * @dev Sign agreement with a signature to prevent replay attacks
     * @param agreementHash Hash of the agreement
     * @param signature Signature of the agreement
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
        require(!milestones[milestoneIndex].verified, "Milestone already verified");

        milestones[milestoneIndex].verified = true;
        emit MilestoneVerified(milestoneIndex);

        // Check if the milestone is the last one
        if (milestoneIndex == milestones.length - 1) {
            finalMilestoneAchieved = true;
            creditClaimDeadline = block.timestamp + CLAIM_PERIOD;
            emit FinalMilestoneAchieved();
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
        mockUSDC.safeTransfer(generalContractor, amount);
        
        // Emit event after successful transfer
        emit FundsWithdrawn(milestoneIndex, amount);
    }

    /**
     * @dev Request extra funds for the project
     * @param proposalHash Hash of the proposal
     * @param amount Amount requested
     * @param description Description of the request
     */
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
     * @dev Allows investors to vote on an extra fund request
     * @param requestId The ID of the extra fund request
     * @param support True to vote in favor, false to vote against
     */
function voteOnExtraFundRequest(uint256 requestId, bool support) external nonReentrant notStopped {
    // First validate the request ID
    require(requestId < extraFundRequests.length, "Invalid request ID");
    
    // Load the request once to reduce storage reads
    ExtraFundRequest storage request = extraFundRequests[requestId];
    
    // Validate voter balance once
    uint256 voterBalance = investorBalances[msg.sender];
    require(voterBalance > 0, "Only investors with stake can vote");
    
    // Check all the request conditions
    require(request.auditorApproved, "Request not approved by auditor");
    require(request.votingEndTime > 0, "Voting period not started");
    require(block.timestamp < request.votingEndTime, "Voting period ended");
    require(!request.executed, "Request already executed");
    require(!hasVoted[requestId][msg.sender], "Already voted");
    
    // Mark voter as having voted
    hasVoted[requestId][msg.sender] = true;
    
    // Update votes using a more gas-efficient approach
    if (support) {
        request.votesFor += voterBalance;
    } else {
        request.votesAgainst += voterBalance;
    }
    
    emit ExtraFundVoteCast(requestId, msg.sender, support, voterBalance);
}

function executeExtraFundRequest(uint256 requestId) external nonReentrant notStopped onlyGeneralContractor {
    // First validate the request ID
    require(requestId < extraFundRequests.length, "Invalid request ID");
    
    // Load the request once to reduce storage reads
    ExtraFundRequest storage request = extraFundRequests[requestId];
    
    // Check all request conditions
    require(request.auditorApproved, "Request not approved by auditor");
    require(block.timestamp >= request.votingEndTime, "Voting period not ended");
    require(!request.executed, "Request already executed");
    
    // Calculate vote totals and check quorum
    uint256 totalVotes = request.votesFor + request.votesAgainst;
    uint256 quorum = (totalVotes * QUORUM_PERCENTAGE) / 100;
    require(totalVotes >= quorum, "Quorum not met");
    
    // Determine if approved and require that the vote passed
    bool approved = request.votesFor > request.votesAgainst;
    require(approved, "Request was not approved by voters");
    
    // Mark as executed (following checks-effects-interactions pattern)
    request.executed = true;
    
    // Transfer the funds to the contractor
    mockUSDC.safeTransfer(generalContractor, request.amount);
    emit ExtraFundRequestExecuted(requestId, true);
}
    /**
     * @dev Verify energy credit redemption
     * @param investor Address of the investor
     */
    function verifyEnergyCreditRedemption(address investor) external nonReentrant onlyEnergyProvider {
        EnergyCreditRedemptions storage redemption = energyCreditRedemptions[investor];
        require(redemption.creditsEarned > 0, "No credits earned to verify");
        require(!redemption.verifiedByProvider, "Credits already verified");

        // Mark the redemption as verified by the provider
        redemption.verifiedByProvider = true;

        emit EnergyCreditsVerified(investor, redemption.creditsEarned);
    }

    /**
     * @dev Burn energy tokens and claim energy credits
     * @param amount Amount of tokens to burn
     */
    function burnAndClaimEnergyCredits(uint256 amount) external nonReentrant {
        require(finalMilestoneAchieved, "Final milestone not yet achieved");
        require(amount > 0, "Burn amount must be greater than zero");
        require(energyToken.balanceOf(msg.sender) >= amount, "Insufficient energy tokens");
        require(energyToken.allowance(msg.sender, address(this)) >= amount, "Token allowance too low");
        
        // Calculate credits earned based on the energyCreditRate
        uint256 creditsEarned = amount * energyCreditRate;
        
        // Burn tokens
        energyToken.burnFrom(msg.sender, amount);

        // Update or create redemption record
        EnergyCreditRedemptions storage redemption = energyCreditRedemptions[msg.sender];
        redemption.tokensBurned += amount;
        redemption.creditsEarned += creditsEarned;
        redemption.redeemed = false;
        redemption.verifiedByProvider = false;

        totalTokensBurned += amount;
        
        emit EnergyTokensBurned(msg.sender, amount);
        emit EnergyCreditsClaimed(msg.sender, creditsEarned);
    }

    /**
     * @dev Get energy credit redemption details for an investor
     * @param investor Address of the investor
     * @return tokensBurned Amount of tokens burned
     * @return creditsEarned Number of energy credits earned
     * @return redeemed Whether credits have been redeemed
     * @return verified Whether credits have been verified by the energy provider
     */
    function getEnergyCreditRedemptionDetails(address investor) external view  returns (
        uint256 tokensBurned,
        uint256 creditsEarned,
        bool redeemed,
        bool verified
    ) {
        require(msg.sender == investor, "You are not authorized to access these details");
        EnergyCreditRedemptions storage redemption = energyCreditRedemptions[investor];
        return (
            redemption.tokensBurned,
            redemption.creditsEarned,
            redemption.redeemed,
            redemption.verifiedByProvider
        );
    }

    /**
     * @dev Get the available funds that can be used to fulfill an extra fund request
     * @return uint256 Available funds
     */
    function getAvailableFunds() public view returns (uint256) {
        // Calculate total allocated funds
        uint256 allocatedFunds = 0;
        
        // Add milestone allocations
        for (uint256 i = 0; i < milestones.length; i++) {
            allocatedFunds += milestones[i].amount;
        }
        
        // Add platform fee
        allocatedFunds += (fundsRaised * proposal.platformFeePercentage) / 100;
        
        // Return available funds
        return fundsRaised > allocatedFunds ? fundsRaised - allocatedFunds : 0;
    }
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



