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
 * and DAO voting for extra fund requests
 */
contract CrowdFunding is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IEnergyToken;
    using ECDSA for bytes32;

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
    //IERC20 public immutable energyToken;
   // EnergyToken public immutable energyToken;
    IEnergyToken public energyToken;

    
    // State variables
    Proposal public proposal;
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
    bool public fundingSuccessful;
    bool public fundingFailed;
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
    event ExtraFundRequestCreated(uint256 indexed requestId, bytes32 proposalHash, uint256 amount);
    event ExtraFundRequestApproved(uint256 indexed requestId);
    event VoteCast(uint256 indexed requestId, address indexed voter, bool support);
    event ExtraFundRequestExecuted(uint256 indexed requestId, bool approved);
    event RefundClaimed(address indexed investor, uint256 amount);
    event SecurityTokensWithdrawn(address indexed generalContractor, uint256 amount);
    event EnergyTokensClaimed(address indexed investor, uint256 amount);

    /**
     * @dev Modifier to check if emergency stop is not activated
     */
    modifier notStopped() {
        require(!emergencyStop, "Contract is in emergency stop");
        _;
    }

    /**
     * @dev Modifier to allow only the auditor to call a function
     */
    modifier onlyAuditor() {
        require(msg.sender == auditor, "Only auditor can call this function");
        _;
    }

    /**
     * @dev Modifier to allow only the general contractor to call a function
     */
    modifier onlyGeneralContractor() {
        require(msg.sender == generalContractor, "Only general contractor can call this function");
        _;
    }

    /**
     * @dev Modifier to allow only the client to call a function
     */
    modifier onlyClient() {
        require(msg.sender == client, "Only client can call this function");
        _;
    }

    /**
     * @dev Modifier to check if funding is active
     */
    modifier whenFundingActive() {
        require(!fundingFailed, "Funding has failed");
        require(!fundingSuccessful, "Funding already successful");
        _;
    }

    /**
     * @dev Constructor to initialize the contract with necessary parameters
     * @param _securityToken Address of the security token
     * @param _utilityToken Address of the utility token
     * @param _energyToken Address of the energy token
     * @param _investmentPeriod Duration of the investment period
     * @param _targetAmount Target funding amount
     * @param _auditor Address of the auditor
     * @param _generalContractor Address of the general contractor
     * @param _milestoneAmounts Array of milestone amounts
     */
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
        require(_client != address(0), "client cannot be zero address");
        require(_investmentPeriod > block.timestamp, "Investment period must be in the future");
        require(_targetAmount > 0, "Target amount must be greater than zero");
        require(_milestoneAmounts.length > 0, "Must have at least one milestone");

        securityToken = IERC20(_securityToken);
        utilityToken = IERC20(_utilityToken);
        energyToken = IEnergyToken(_energyToken);
        energyToken = IEnergyToken(_energyToken);  // Initialize EnergyToken

        proposal = Proposal({investmentPeriod: _investmentPeriod, targetAmount: _targetAmount});
        auditor = _auditor;
        generalContractor = _generalContractor;
        client=_client;
        
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
     * @dev Check if the investment period has ended and if funding failed
     * @return bool Whether funding failed
     */
    function checkFundingStatus() public returns (bool) {
        // If funding is already successful or failed, return current status
        if (fundingSuccessful) return false;
        if (fundingFailed) return true;
        
        // If investment period has ended and target not reached, mark as failed
        if (block.timestamp > proposal.investmentPeriod && fundsRaised < proposal.targetAmount) {
            fundingFailed = true;
            emit FundingFailed();
            return true;
        }
        
        return false;
    }

    /**
     * @dev Pledge security tokens to the contract (done by general contractor)
     * @param amount Amount of security tokens to pledge
     */
    

// Pledge tokens function
    function pledgeTokens(uint256 amount) external {
        // Ensure only the client can pledge tokens
        require(msg.sender == client, "Only the client can pledge tokens");

        // Ensure the pledge amount is greater than zero
        require(amount > 0, "Pledge amount must be greater than zero");

        // Step 1: Ensure the client has approved the contract to transfer tokens on their behalf
        require(securityToken.allowance(client, address(this)) >= amount, "Allowance too low");

        // Step 2: Transfer SecurityTokens from client to the contract
        securityToken.safeTransferFrom(client, address(this), amount);

        // Step 3: Mint equivalent EnergyTokens (this is done via the energyToken contract)
        energyToken.mint(address(this), amount);

        // Step 4: Set pledge status to true
        tokensPledged = true;

        // Emit the TokensPledged event
        emit TokensPledged(client, amount);
    }


function invest(uint256 amount) external nonReentrant notStopped whenFundingActive returns (bool success) {
    // Validate investment amount and conditions
    require(amount > 0, "INVEST: Amount must be greater than zero");
    require(tokensPledged, "INVEST: Security tokens not pledged");
    require(block.timestamp <= proposal.investmentPeriod, "INVEST: Investment period has ended");

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

    // Check if the funding goal is reached and release energy tokens automatically
    if (newTotalRaised >= proposal.targetAmount && !fundingSuccessful) {
        fundingSuccessful = true;
        emit FundingSuccessful();

        // Automatically release energy tokens to all investors
        _releaseEnergyTokens();
    }

    return true;
}

// Add this function to your CrowdFunding contract

/**
 * @dev Internal function to release energy tokens when funding is successful
 */
function _releaseEnergyTokens() internal {
    require(fundingSuccessful, "Funding must be successful to release tokens");
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
    require(fundingSuccessful, "Funding must be successful to claim tokens");
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
     * @dev Claim refun if funding failed
     */
    function claimRefund() external nonReentrant {
        // Check or update funding status
        checkFundingStatus();
        
        require(fundingFailed, "Funding has not failed");
        require(investorBalances[msg.sender] > 0, "No investment to refund");
        require(!hasWithdrawnRefund[msg.sender], "Refund already claimed");
        
        uint256 amount = investorBalances[msg.sender];
        hasWithdrawnRefund[msg.sender] = true;
        
        utilityToken.safeTransfer(msg.sender, amount);
        emit RefundClaimed(msg.sender, amount);
    }




    /**
     * @dev Withdraw security tokens if funding failed
     */
    function withdrawSecurityTokens() external nonReentrant onlyGeneralContractor {
        // Check or update funding status
        checkFundingStatus();
        
        require(fundingFailed, "Funding has not failed");
        require(tokensPledged, "No tokens pledged");
        require(!securityTokensWithdrawn, "Security tokens already withdrawn");
        
        securityTokensWithdrawn = true;
        
        uint256 amount = securityToken.balanceOf(address(this));
        securityToken.safeTransfer(generalContractor, amount);
        emit SecurityTokensWithdrawn(generalContractor, amount);
    }

    // /**
    //  * @dev Sign agreement with a signature to prevent replay attacks
    //  * @param agreementHash Hash of the agreement
    //  * @param signature Signature of the agreement
    //  */
    // function signAgreement(bytes32 agreementHash, bytes calldata signature) external nonReentrant notStopped onlyGeneralContractor {
    //     require(!gcAgreement, "Already signed");
    //     require(fundingSuccessful, "Funding must be successful first");
        
    //     // Create EIP-712 compliant message
    //     bytes32 digest = keccak256(
    //         abi.encodePacked(
    //             "\x19\x01",
    //             DOMAIN_SEPARATOR,
    //             keccak256(abi.encode(agreementHash, address(this), block.chainid))
    //         )
    //     );
        
    //     address signer = ECDSA.recover(digest, signature);
    //     require(signer == generalContractor, "Invalid signature");

    //     gcAgreement = true;
    //     emit AgreementSigned(generalContractor);
    // }

    // /**
    //  * @dev Verify a milestone completion
    //  * @param milestoneIndex Index of the milestone to verify
    //  */
    // function verifyMilestone(uint256 milestoneIndex) external nonReentrant notStopped onlyAuditor {
    //     require(fundingSuccessful, "Funding must be successful first");
    //     require(gcAgreement, "General contractor must sign agreement first");
    //     require(milestoneIndex < milestones.length, "Invalid milestone index");
    //     require(!milestones[milestoneIndex].verified, "Milestone already verified");
        
    //     milestones[milestoneIndex].verified = true;
    //     emit MilestoneVerified(milestoneIndex);
    // }

    // /**
    //  * @dev Withdraw funds for completed milestone
    //  * @param milestoneIndex Index of the verified milestone
    //  */
    // function withdrawByGC(uint256 milestoneIndex) external nonReentrant notStopped onlyGeneralContractor {
    //     require(milestoneIndex < milestones.length, "Invalid milestone index");
    //     require(milestones[milestoneIndex].verified, "Milestone not verified");
    //     require(!milestones[milestoneIndex].fundsReleased, "Funds already released");
        
    //     // Update state before transfer
    //     milestones[milestoneIndex].fundsReleased = true;
        
    //     uint256 amount = milestones[milestoneIndex].amount;
    //     utilityToken.safeTransfer(generalContractor, amount);
        
    //     emit FundsWithdrawn(milestoneIndex, amount);
    // }

    // /**
    //  * @dev Request extra funds with a proposal
    //  * @param proposalHash Hash of the detailed proposal
    //  * @param amount Amount of additional funds requested
    //  * @param description Brief description of the request
    //  */
    // function requestExtraFunds(
    //     bytes32 proposalHash, 
    //     uint256 amount, 
    //     string calldata description
    // ) external nonReentrant notStopped onlyGeneralContractor {
    //     require(fundingSuccessful, "Funding must be successful first");
    //     require(gcAgreement, "General contractor must sign agreement first");
    //     require(amount > 0, "Amount must be greater than zero");
        
    //     uint256 requestId = extraFundRequests.length;
        
    //     extraFundRequests.push(ExtraFundRequest({
    //         proposalHash: proposalHash,
    //         amount: amount,
    //         description: description,
    //         createdAt: block.timestamp,
    //         auditorApproved: false,
    //         votingEndTime: 0,
    //         votesFor: 0,
    //         votesAgainst: 0,
    //         executed: false
    //     }));
        
    //     emit ExtraFundRequestCreated(requestId, proposalHash, amount);
    // }

    // /**
    //  * @dev Approve extra fund request and open it for voting
    //  * @param requestId ID of the extra fund request
    //  */
    // function approveExtraFundRequest(uint256 requestId) external nonReentrant notStopped onlyAuditor {
    //     require(requestId < extraFundRequests.length, "Invalid request ID");
        
    //     ExtraFundRequest storage request = extraFundRequests[requestId];
        
    //     require(!request.auditorApproved, "Request already approved");
    //     require(!request.executed, "Request already executed");
        
    //     request.auditorApproved = true;
    //     request.votingEndTime = block.timestamp + VOTING_PERIOD;
        
    //     emit ExtraFundRequestApproved(requestId);
    // }

    // /**
    //  * @dev Vote on an extra fund request
    //  * @param requestId ID of the request to vote on
    //  * @param support True to vote for, false to vote against
    //  */
    // function vote(uint256 requestId, bool support) external nonReentrant notStopped {
    //     require(requestId < extraFundRequests.length, "Invalid request ID");
    //     require(investorBalances[msg.sender] > 0, "Only investors can vote");
    //     require(!hasVoted[requestId][msg.sender], "Already voted");
        
    //     ExtraFundRequest storage request = extraFundRequests[requestId];
        
    //     require(request.auditorApproved, "Request not approved by auditor");
    //     require(block.timestamp < request.votingEndTime, "Voting period ended");
    //     require(!request.executed, "Request already executed");
        
    //     hasVoted[requestId][msg.sender] = true;
        
    //     if (support) {
    //         request.votesFor += investorBalances[msg.sender];
    //     } else {
    //         request.votesAgainst += investorBalances[msg.sender];
    //     }
        
    //     emit VoteCast(requestId, msg.sender, support);
    // }

    // /**
    //  * @dev Execute an approved extra fund request after voting period
    //  * @param requestId ID of the request to execute
    //  */
    // function executeExtraFundRequest(uint256 requestId) external nonReentrant notStopped {
    //     require(requestId < extraFundRequests.length, "Invalid request ID");
        
    //     ExtraFundRequest storage request = extraFundRequests[requestId];
        
    //     require(request.auditorApproved, "Request not approved by auditor");
    //     require(block.timestamp >= request.votingEndTime, "Voting period not ended");
    //     require(!request.executed, "Request already executed");
        
    //     request.executed = true;
        
    //     // Check if the request was approved by majority vote
    //     bool approved = request.votesFor > request.votesAgainst;
        
    //     if (approved) {
    //         // Transfer the requested amount to the general contractor
    //         utilityToken.safeTransfer(generalContractor, request.amount);
    //     }
        
    //     emit ExtraFundRequestExecuted(requestId, approved);
    // }

    // /**
    //  * @dev Get the total number of milestones
    //  * @return uint256 Number of milestones
    //  */
    // function getMilestoneCount() external view returns (uint256) {
    //     return milestones.length;
    // }

    // /**
    //  * @dev Get milestone details
    //  * @param milestoneIndex Index of the milestone
    //  * @return amount Amount for the milestone
    //  * @return verified Whether the milestone is verified
    //  * @return fundsReleased Whether funds for the milestone have been released
    //  */
    // function getMilestoneDetails(uint256 milestoneIndex) external view returns (
    //     uint256 amount,
    //     bool verified,
    //     bool fundsReleased
    // ) {
    //     require(milestoneIndex < milestones.length, "Invalid milestone index");
    //     Milestone storage milestone = milestones[milestoneIndex];
    //     return (milestone.amount, milestone.verified, milestone.fundsReleased);
    // }

    // /**
    //  * @dev Get the total number of extra fund requests
    //  * @return uint256 Number of extra fund requests
    //  */
    // function getExtraFundRequestCount() external view returns (uint256) {
    //     return extraFundRequests.length;
    // }

    // /**
    //  * @dev Get extra fund request details
    //  * @param requestId ID of the request
    //  * @return proposalHash Proposal hash
    //  * @return amount Requested amount
    //  * @return description Request description
    //  * @return auditorApproved Whether auditor approved the request
    //  * @return votingEndTime End time for voting
    //  * @return votesFor Number of votes for
    //  * @return votesAgainst Number of votes against
    //  * @return executed Whether the request has been executed
    //  */
    // function getExtraFundRequestDetails(uint256 requestId) external view returns (
    //     bytes32 proposalHash,
    //     uint256 amount,
    //     string memory description,
    //     bool auditorApproved,
    //     uint256 votingEndTime,
    //     uint256 votesFor,
    //     uint256 votesAgainst,
    //     bool executed
    // ) {
    //     require(requestId < extraFundRequests.length, "Invalid request ID");
    //     ExtraFundRequest storage request = extraFundRequests[requestId];
        
    //     return (
    //         request.proposalHash,
    //         request.amount,
    //         request.description,
    //         request.auditorApproved,
    //         request.votingEndTime,
    //         request.votesFor,
    //         request.votesAgainst,
    //         request.executed
    //     );
    // }
}