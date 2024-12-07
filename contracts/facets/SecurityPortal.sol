// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";
import { LibDiamondLoupeFacet } from "../libraries/LibDiamondLoupeFacet.sol";
import { ISecurityPortal } from "../interfaces/ISecurityPortal.sol";
import { IERC20 } from "../interfaces/IERC20.sol";
import { SecurityContract } from "../tokens/SecurityContract.sol";
import { SecurityNFT } from "../tokens/ERC721.sol";
import { DiamondLoupeFacet } from "./DiamondLoupeFacet.sol";
import { UserData } from "./UserData.sol";

contract  SecurityPortal is ISecurityPortal {

    event RegisterSecurityProposal(string indexed hashProposal, address indexed gc);
    event ModifySecurityProposal(string indexed oldHashProposal, string indexed newHashProposal);
    event VerifySecurityProposal(address indexed auditor, address indexed securityContractAddress, string indexed _hashProposal);


        modifier AuditorOnly(address _auditor) {
            require(LibInfraFundStorage.isAuditor(_auditor), "Your Not Auditor");
            _;
        }

        modifier ClientOnly(address _client) {
            require(LibInfraFundStorage.isVerifiedClient(_client), "Your Not Client");
            _;
        }


    function registerSecurityProposal(
        string memory _name,
        string memory _symbol,
        string memory _hashProposal,
        uint256 _endOfInvestmentPeriodTime, 
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {
        
        require(LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].proposer == address(0), "This Proposal Hash Already Exist");
        require(LibInfraFundStorage.isGC(_gc), "GC Is Not Verified");
        
        IERC20(LibInfraFundStorage.infraFundStorage().tokenPayment).transferFrom(msg.sender, address(this), LibInfraFundStorage.infraFundStorage().proposalFee);

        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].name = _name;
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].symbol = _symbol;
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].proposer = msg.sender;
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].contractAddress = address(0);
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].nftAddress = address(0);
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].gc = _gc;
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].targetAmountOfCapital = _targetAmountOfCapital;
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].isVerified = false;

        for(uint8 i=0; i < _stages.length; i++ ) {
            LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].stages[i] = LibInfraFundStorage.GCStages(
                    _stages[i].neededFund, 
                    _stages[i].proposedFinishTime,
                    _stages[i].KPI
            );
        }

        LibInfraFundStorage.infraFundStorage().proposals.push(_hashProposal);
        LibInfraFundStorage.infraFundStorage().projectType[_hashProposal] = LibInfraFundStorage.infraFundStorage().security;
        
        emit RegisterSecurityProposal(_hashProposal, _gc);
    }

    function modifySecurityProposal(
        string memory _oldHashProposal, 
        string memory _newHashProposal,
        uint256 _endOfInvestmentPeriodTime,
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {

        require(LibInfraFundStorage.infraFundStorage().securityProjects[_oldHashProposal].proposer != address(0), "This security Proposal Hash Not Exist");
        require(LibInfraFundStorage.isGC(_gc), "GC Is Not Verified");
        require(LibInfraFundStorage.infraFundStorage().securityProjects[_oldHashProposal].proposer == msg.sender, "You Are Not Proposer For This Proposal");
        require(!LibInfraFundStorage.infraFundStorage().securityProjects[_oldHashProposal].isVerified, "After Verified ,Cant Change Proposal");

        for(uint8 i=0; i < _stages.length; i++ ) {
            LibInfraFundStorage.infraFundStorage().securityProjects[_newHashProposal].stages[i] = LibInfraFundStorage.GCStages(
                    _stages[i].neededFund, 
                    _stages[i].proposedFinishTime,
                    _stages[i].KPI
            );
        }
        
        LibInfraFundStorage.infraFundStorage().securityProjects[_newHashProposal].endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        LibInfraFundStorage.infraFundStorage().securityProjects[_newHashProposal].targetAmountOfCapital = _targetAmountOfCapital;
        LibInfraFundStorage.infraFundStorage().securityProjects[_newHashProposal].gc = _gc;

        emit ModifySecurityProposal(_oldHashProposal, _newHashProposal);
    }

    function verifySecurityProposal(string memory _hashProposal, string memory _nftURI) AuditorOnly(msg.sender) external {

        require(LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].proposer != address(0), "This Security Proposal Hash Not Exist");
        require(!LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].isVerified, "This Proposal Already Verified");

        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].isVerified = true;

        SecurityNFT nftContract = new SecurityNFT(LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].name , LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].symbol);

        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].nftURI = _nftURI;
        
        SecurityContract securityContract = new SecurityContract(
            LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].targetAmountOfCapital,
            LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].endOfInvestmentPeriodTime,
            LibInfraFundStorage.AddressStruct(
                LibDiamondLoupeFacet.facetAddress(UserData.getAddress.selector), 
                LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].proposer,
                address(nftContract),
                LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].gc,
                LibInfraFundStorage.infraFundStorage().tokenPayment
            ),
            LibInfraFundStorage.StringStruct(
                _hashProposal,
                LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].name,
                LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].symbol,
                LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].nftURI
            ),
            LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].stages
        );
        
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].contractAddress = address(securityContract);
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].nftAddress = address(nftContract);
        LibInfraFundStorage.infraFundStorage().securityProjects[_hashProposal].nftURI = _nftURI;

        emit VerifySecurityProposal(msg.sender, address(securityContract), _hashProposal);
    }

}
