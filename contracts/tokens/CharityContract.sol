// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IERC20 } from "../interfaces/IERC20.sol";
import { IPermissionManagement } from "../interfaces/IPermissionManagement.sol";
// import { ICharityContract } from "../interfaces/ICharityContract.sol";
import { ICharityNFT } from "../interfaces/ICharityNFT.sol";
import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";
import { ICharityData } from "../interfaces/ICharityData.sol";

// import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CharityContract { 

    
    uint256 public currentCampaignBalance;
    address public infraFund;
    address public tokenPayment;
    uint32 public totalInvstors;
    
    mapping(address => bool) public investors;
    mapping(address => uint256) public investorBalance;
    mapping(address => bool) public investorClaimedNFT;
    mapping(uint256 =>  uint256) private numberOfVotesToAccept;
    mapping(address => mapping(uint256 => bool)) private investorVote;

    LibInfraFundStorage.CharityProject project;


    modifier AuditorOnly(address _auditor) {
        require(IPermissionManagement(infraFund).isAuditor(_auditor), "Your Not Auditor");
        _;
    }

    modifier InvestorOnly(address _investor) {
        require(investors[_investor] || IPermissionManagement(infraFund).isInvestor(_investor), "Your Not Investor");
        _;
    }

    modifier GCOnly(address _gc) {
        require(project.gc == msg.sender, "Your Not GC");
        _;
    }

    event InvestmentToCharity(address indexed investor, uint256 amount);
    event GCWithdraw(address indexed GC, uint256 indexed stage);
    event StageVerified(address indexed auditor, uint256 indexed stage);
    event RequestExtraFund(address indexed GC, uint256 indexed stage, string indexed hashPropoal, uint256 amount);
    event ExtraFundVerified(address indexed auditor, uint256 indexed stage);
    event ExtraFundWithdraw(address indexed GC, uint256 indexed stage);

    constructor(address _tokenPayment, address _infraFund, string memory hashProposal) {
        
        // Set infra address for fetch charity projects data
        LibInfraFundStorage.CharityProject memory tmp_project = ICharityData(_infraFund).projectData(hashProposal);  

        project.name = tmp_project.name;
        project.symbol = tmp_project.symbol;
        project.proposer = tmp_project.proposer;
        project.contractAddress = address(this);
        project.nftAddress = tmp_project.nftAddress;
        project.gc = tmp_project.gc;
        project.endOfInvestmentPeriodTime = tmp_project.endOfInvestmentPeriodTime;
        project.targetAmountOfCapital = tmp_project.targetAmountOfCapital;
        project.isVerified = tmp_project.isVerified;

        for(uint8 i=0; i < tmp_project.stages.length; i++ ) {
            project.stages[i].neededFund = tmp_project.stages[i].neededFund;
            project.stages[i].proposedFinishTime = tmp_project.stages[i].proposedFinishTime;
            project.stages[i].KPI = tmp_project.stages[i].KPI;
        }

        infraFund = _infraFund;

        currentCampaignBalance = 0;
        totalInvstors = 0;
        tokenPayment = _tokenPayment;
    }

    function invest(uint256 _amount) InvestorOnly(msg.sender) external {

        require(_amount + currentCampaignBalance > project.targetAmountOfCapital, "Amount Is More Than Target Amount");
        require(block.timestamp > project.endOfInvestmentPeriodTime, "Investment Time Has Expired");

        investorBalance[msg.sender] += _amount;
        currentCampaignBalance += _amount;
        totalInvstors += 1;

        if (investors[msg.sender] == false) { 
            investors[msg.sender] = true;
        }

        IERC20(tokenPayment).transferFrom(msg.sender, address(this), _amount);
        emit InvestmentToCharity(msg.sender, _amount);
    }

    function claimNFT() InvestorOnly(msg.sender) external {

        require(project.endOfInvestmentPeriodTime <= block.timestamp, "Investment Time Not Complated");
        require(investorBalance[msg.sender] > 0, "Your Not Investor in this Project");
        require(!investorClaimedNFT[msg.sender], "Already NFT claimed");

        investorClaimedNFT[msg.sender] = true;
        ICharityNFT(project.nftAddress).awardItem(msg.sender, project.nftURI);

        // get clainNFT notif from blockchain from block scaning instead of events 
        // emit ClaimedNFT(msg.sender);
    }

    function VerifyMessageFromGC(bytes32 _hashedMessage, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
        bytes memory prefix = "\x19I accept this agreement with this content:\n32";
        bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, _hashedMessage));
        address signer = ecrecover(prefixedHashMessage, _v, _r, _s);
        return signer;
    }

    function verifyStage(uint256 _stage) AuditorOnly(msg.sender) external {
        
        require(_stage < project.stages.length, "Stage is not exists");
        require(!project.stages[_stage].isVerfied, "Stage is already verified");
        require(block.timestamp > project.stages[_stage].proposedFinishTime, "Stage is not finish");

        project.stages[_stage].isVerfied = true;

        emit StageVerified(msg.sender, _stage);
    }

    function withdrawByGC(uint256 _stage) GCOnly(msg.sender) external {

        require(_stage < project.stages.length, "Stage is not exists");
        require(project.stages[_stage].isVerfied, "Stage is not verified");
        require(!project.stages[_stage].isClaimed, "Stage already claimed");

        project.stages[_stage].isClaimed = true;

        IERC20(tokenPayment).transferFrom(address(this), msg.sender, project.stages[_stage].neededFund);

        emit GCWithdraw(msg.sender, _stage);
    }

    function requestExtraFund(uint256 _stage, uint256 _extraFund, string memory _hashPropoal) GCOnly(msg.sender) external {

        require(_stage < project.stages.length, "Stage is not exists");
        require(project.stages[_stage].isVerfied, "Stage is not verified yet!");
        require(project.stages[_stage].neededExtraFund == 0, "Already Requested!");

        project.stages[_stage].proposalHashForExtraFund = _hashPropoal;
        project.stages[_stage].neededExtraFund = _extraFund;

        emit RequestExtraFund(msg.sender, _stage, _hashPropoal, _extraFund);
    }

    function verifyExtraFund(uint256 _stage) AuditorOnly(msg.sender) external {
        
        require(_stage < project.stages.length, "Stage is not exists");
        require(!project.stages[_stage].isVerfiedExtraFund, "Extrafund Already Verified");
        require(project.stages[_stage].neededExtraFund > 0, "Extrafund Not Requested");

        project.stages[_stage].isVerfiedExtraFund = true;
        emit ExtraFundVerified(msg.sender, _stage);
    }

    function acceptExtraFundProposalByInvestors(uint256 _stage) InvestorOnly(msg.sender) external {
        
        require(investorBalance[msg.sender] > 0, "You Not Permission");
        require(_stage < project.stages.length, "This stage is not exists");
        require(project.stages[_stage].isVerfiedExtraFund, "This Extra fund stage is not verified");
        require(!investorVote[msg.sender][_stage], "You vote already");

        numberOfVotesToAccept[_stage] += 1;        
        investorVote[msg.sender][_stage] = true;
    }

    function withdrawExtraFundByGC(uint256 _stage) GCOnly(msg.sender) external {
        
        require(_stage < project.stages.length, "Stage is not exists");
        require(project.stages[_stage].isVerfiedExtraFund, "ExtraFund Stage Not Verified");
        require(!project.stages[_stage].isClaimedExtraFund, "ExtraFund Stage Already Claimed");
        require(numberOfVotesToAccept[_stage] > totalInvstors / 2 , "Not Enough Votes");

        project.stages[_stage].isClaimedExtraFund = true;

        IERC20(tokenPayment).transferFrom(address(this), msg.sender, project.stages[_stage].neededExtraFund);
        emit ExtraFundWithdraw(msg.sender, _stage);
    }

    // =========== Read Data ===========

    function getNumberMilestons() external view returns(uint256) {
        return project.stages.length;
    }

    function projectData() external view returns(LibInfraFundStorage.CharityProject memory) {
        return project;
    } 

}
