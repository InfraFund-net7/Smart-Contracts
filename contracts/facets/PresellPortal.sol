// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";
import { LibDiamondLoupeFacet } from "../libraries/LibDiamondLoupeFacet.sol";
import { IPresellPortal } from "../interfaces/IPresellPortal.sol";
import { IERC20 } from "../interfaces/IERC20.sol";
import { PresellContract } from "../tokens/PresellContract.sol";
import { PresellNFT } from "../tokens/ERC721.sol";
import { DiamondLoupeFacet } from "./DiamondLoupeFacet.sol";
import { UserData } from "./UserData.sol";

contract  PresellPortal is IPresellPortal {

    event RegisterPresellProposal(string indexed hashProposal, address indexed gc);
    event ModifyPresellProposal(string indexed oldHashProposal, string indexed newHashProposal);
    event VerifyPresellProposal(address indexed auditor, address indexed presellContractAddress, string indexed _hashProposal);


        modifier AuditorOnly(address _auditor) {
            require(LibInfraFundStorage.isAuditor(_auditor), "Your Not Auditor");
            _;
        }

        modifier ClientOnly(address _client) {
            require(LibInfraFundStorage.isVerifiedClient(_client), "Your Not Client");
            _;
        }


    function registerPresellProposal(
        string memory _name,
        string memory _symbol,
        string memory _hashProposal,
        uint256 _endOfInvestmentPeriodTime, 
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {
        
        require(LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].proposer == address(0), "This Proposal Hash Already Exist");
        require(LibInfraFundStorage.isGC(_gc), "GC Is Not Verified");
        
        IERC20(LibInfraFundStorage.infraFundStorage().tokenPayment).transferFrom(msg.sender, address(this), LibInfraFundStorage.infraFundStorage().proposalFee);

        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].name = _name;
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].symbol = _symbol;
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].proposer = msg.sender;
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].contractAddress = address(0);
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].nftAddress = address(0);
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].gc = _gc;
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].targetAmountOfCapital = _targetAmountOfCapital;
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].isVerified = false;

        for(uint8 i=0; i < _stages.length; i++ ) {
            LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].stages[i] = LibInfraFundStorage.GCStages(
                    _stages[i].neededFund, 
                    _stages[i].proposedFinishTime,
                    _stages[i].KPI
            );
        }

        LibInfraFundStorage.infraFundStorage().proposals.push(_hashProposal);
        LibInfraFundStorage.infraFundStorage().projectType[_hashProposal] = LibInfraFundStorage.infraFundStorage().PRESELL;
        
        emit RegisterPresellProposal(_hashProposal, _gc);
    }

    function modifyPresellProposal(
        string memory _oldHashProposal, 
        string memory _newHashProposal,
        uint256 _endOfInvestmentPeriodTime,
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {

        require(LibInfraFundStorage.infraFundStorage().presellProjects[_oldHashProposal].proposer != address(0), "This Presell Proposal Hash Not Exist");
        require(LibInfraFundStorage.isGC(_gc), "GC Is Not Verified");
        require(LibInfraFundStorage.infraFundStorage().presellProjects[_oldHashProposal].proposer == msg.sender, "You Are Not Proposer For This Proposal");
        require(!LibInfraFundStorage.infraFundStorage().presellProjects[_oldHashProposal].isVerified, "After Verified ,Cant Change Proposal");

        for(uint8 i=0; i < _stages.length; i++ ) {
            LibInfraFundStorage.infraFundStorage().presellProjects[_newHashProposal].stages[i] = LibInfraFundStorage.GCStages(
                    _stages[i].neededFund, 
                    _stages[i].proposedFinishTime,
                    _stages[i].KPI
            );
        }
        
        LibInfraFundStorage.infraFundStorage().presellProjects[_newHashProposal].endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        LibInfraFundStorage.infraFundStorage().presellProjects[_newHashProposal].targetAmountOfCapital = _targetAmountOfCapital;
        LibInfraFundStorage.infraFundStorage().presellProjects[_newHashProposal].gc = _gc;

        emit ModifyPresellProposal(_oldHashProposal, _newHashProposal);
    }

    function verifyPresellProposal(string memory _hashProposal, string memory _nftURI) AuditorOnly(msg.sender) external {

        require(LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].proposer != address(0), "This Presell Proposal Hash Not Exist");
        require(!LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].isVerified, "This Proposal Already Verified");

        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].isVerified = true;

        PresellNFT nftContract = new PresellNFT(LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].name , LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].symbol);

        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].nftURI = _nftURI;
        
        PresellContract presellContract = new PresellContract(
            LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].targetAmountOfCapital,
            LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].endOfInvestmentPeriodTime,
            LibInfraFundStorage.AddressStruct(
                LibDiamondLoupeFacet.facetAddress(UserData.getAddress.selector), 
                LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].proposer,
                address(nftContract),
                LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].gc,
                LibInfraFundStorage.infraFundStorage().tokenPayment
            ),
            LibInfraFundStorage.StringStruct(
                _hashProposal,
                LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].name,
                LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].symbol,
                LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].nftURI
            ),
            LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].stages
        );
        
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].contractAddress = address(presellContract);
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].nftAddress = address(nftContract);
        LibInfraFundStorage.infraFundStorage().presellProjects[_hashProposal].nftURI = _nftURI;

        emit VerifyPresellProposal(msg.sender, address(presellContract), _hashProposal);
    }

}
