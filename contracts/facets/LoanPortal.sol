// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";
import { LibDiamondLoupeFacet } from "../libraries/LibDiamondLoupeFacet.sol";
import { ILoanPortal } from "../interfaces/ILoanPortal.sol";
import { IERC20 } from "../interfaces/IERC20.sol";
import { LoanContract } from "../tokens/LoanContract.sol";
import { LoanNFT } from "../tokens/ERC721.sol";
import { DiamondLoupeFacet } from "./DiamondLoupeFacet.sol";
import { UserData } from "./UserData.sol";

contract  LoanPortal is ILoanPortal {

    event RegisterLoanProposal(string indexed hashProposal, address indexed gc);
    event ModifyLoanProposal(string indexed oldHashProposal, string indexed newHashProposal);
    event VerifyLoanProposal(address indexed auditor, address indexed loanContractAddress, string indexed _hashProposal);


        modifier AuditorOnly(address _auditor) {
            require(LibInfraFundStorage.isAuditor(_auditor), "Your Not Auditor");
            _;
        }

        modifier ClientOnly(address _client) {
            require(LibInfraFundStorage.isVerifiedClient(_client), "Your Not Client");
            _;
        }


    function registerLoanProposal(
        string memory _name,
        string memory _symbol,
        string memory _hashProposal,
        uint256 _endOfInvestmentPeriodTime, 
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {
        
        require(LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].proposer == address(0), "This Proposal Hash Already Exist");
        require(LibInfraFundStorage.isGC(_gc), "GC Is Not Verified");
        
        IERC20(LibInfraFundStorage.infraFundStorage().tokenPayment).transferFrom(msg.sender, address(this), LibInfraFundStorage.infraFundStorage().proposalFee);

        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].name = _name;
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].symbol = _symbol;
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].proposer = msg.sender;
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].contractAddress = address(0);
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].nftAddress = address(0);
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].gc = _gc;
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].targetAmountOfCapital = _targetAmountOfCapital;
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].isVerified = false;

        for(uint8 i=0; i < _stages.length; i++ ) {
            LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].stages[i] = LibInfraFundStorage.GCStages(
                    _stages[i].neededFund, 
                    _stages[i].proposedFinishTime,
                    _stages[i].KPI
            );
        }

        LibInfraFundStorage.infraFundStorage().proposals.push(_hashProposal);
        LibInfraFundStorage.infraFundStorage().projectType[_hashProposal] = LibInfraFundStorage.infraFundStorage().Loan;
        
        emit RegisterLoanProposal(_hashProposal, _gc);
    }

    function modifyLoanProposal(
        string memory _oldHashProposal, 
        string memory _newHashProposal,
        uint256 _endOfInvestmentPeriodTime,
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {

        require(LibInfraFundStorage.infraFundStorage().loanProjects[_oldHashProposal].proposer != address(0), "This Loan Proposal Hash Not Exist");
        require(LibInfraFundStorage.isGC(_gc), "GC Is Not Verified");
        require(LibInfraFundStorage.infraFundStorage().loanProjects[_oldHashProposal].proposer == msg.sender, "You Are Not Proposer For This Proposal");
        require(!LibInfraFundStorage.infraFundStorage().loanProjects[_oldHashProposal].isVerified, "After Verified ,Cant Change Proposal");

        for(uint8 i=0; i < _stages.length; i++ ) {
            LibInfraFundStorage.infraFundStorage().loanProjects[_newHashProposal].stages[i] = LibInfraFundStorage.GCStages(
                    _stages[i].neededFund, 
                    _stages[i].proposedFinishTime,
                    _stages[i].KPI
            );
        }
        
        LibInfraFundStorage.infraFundStorage().loanProjects[_newHashProposal].endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        LibInfraFundStorage.infraFundStorage().loanProjects[_newHashProposal].targetAmountOfCapital = _targetAmountOfCapital;
        LibInfraFundStorage.infraFundStorage().loanProjects[_newHashProposal].gc = _gc;

        emit ModifyLoanProposal(_oldHashProposal, _newHashProposal);
    }

    function verifyLoanProposal(string memory _hashProposal, string memory _nftURI) AuditorOnly(msg.sender) external {

        require(LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].proposer != address(0), "This Loan Proposal Hash Not Exist");
        require(!LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].isVerified, "This Proposal Already Verified");

        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].isVerified = true;

        LoanNFT nftContract = new LoanNFT(LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].name , LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].symbol);

        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].nftURI = _nftURI;
        
        LoanContract loanContract = new LoanContract(
            LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].targetAmountOfCapital,
            LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].endOfInvestmentPeriodTime,
            LibInfraFundStorage.AddressStruct(
                LibDiamondLoupeFacet.facetAddress(UserData.getAddress.selector), 
                LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].proposer,
                address(nftContract),
                LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].gc,
                LibInfraFundStorage.infraFundStorage().tokenPayment
            ),
            LibInfraFundStorage.StringStruct(
                _hashProposal,
                LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].name,
                LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].symbol,
                LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].nftURI
            ),
            LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].stages
        );
        
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].contractAddress = address(loanContract);
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].nftAddress = address(nftContract);
        LibInfraFundStorage.infraFundStorage().loanProjects[_hashProposal].nftURI = _nftURI;

        emit VerifyLoanProposal(msg.sender, address(loanContract), _hashProposal);
    }

}
