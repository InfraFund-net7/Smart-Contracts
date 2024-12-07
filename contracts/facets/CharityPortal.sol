// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";
import { LibDiamondLoupeFacet } from "../libraries/LibDiamondLoupeFacet.sol";
import { ICharityPortal } from "../interfaces/ICharityPortal.sol";
import { IERC20 } from "../interfaces/IERC20.sol";
import { CharityContract } from "../tokens/CharityContract.sol";
import { CharityNFT } from "../tokens/ERC721.sol";
import { DiamondLoupeFacet } from "./DiamondLoupeFacet.sol";

contract  CharityPortal  {

    event TickerSymbol(string indexed symbol);
    event RegisterCharityProposal(string indexed hashProposal);
    event VerifyCharityProposal(address indexed auditor, address indexed charityContractAddress, string indexed _hashProposal);


    modifier AuditorOnly(address _auditor) {
        require(LibInfraFundStorage.infraFundStorage().auditors[_auditor], "Your Not Auditor");
        _;
    }


    modifier ClientOnly(address _client) {
        require(LibInfraFundStorage.infraFundStorage().verifiedClients[_client], "Your Not Client");
        _;
    }

    function tickerSymbol(string memory symbol) external ClientOnly(msg.sender) {
        
        
        require(LibInfraFundStorage.infraFundStorage().reservedSymbols[symbol].sender == address(0) ||
            (LibInfraFundStorage.infraFundStorage().reservedSymbols[symbol].sender != address(0) && 
            block.timestamp - LibInfraFundStorage.infraFundStorage().reservedSymbols[symbol].reservedTime > 60 days), "This Symbol Already Reserved");
        
        LibInfraFundStorage.infraFundStorage().reservedSymbols[symbol].sender = msg.sender;
        LibInfraFundStorage.infraFundStorage().reservedSymbols[symbol].reservedTime = block.timestamp;

        emit TickerSymbol(symbol);
    }


    function registerCharityProposal(
        string memory _name,
        string memory _symbol,
        string memory _hashProposal,
        uint256 _endOfInvestmentPeriodTime, 
        uint256 _targetAmountOfCapital,
        address _gc,
        LibInfraFundStorage.GCStages[] memory _stages
        ) external ClientOnly(msg.sender) {
        
        LibInfraFundStorage.CharityProject storage charityProject = LibInfraFundStorage.infraFundStorage().charityProjects[_hashProposal];
        
        require(LibInfraFundStorage.infraFundStorage().reservedSymbols[_symbol].sender == msg.sender, "You are not ticker of this symbol");
        require(LibInfraFundStorage.infraFundStorage().reservedSymbols[_symbol].reservedTime <= 60 days, "This ticker symbol expired");
        require(charityProject.proposer == address(0), "This Proposal Hash Already Exist");
        require(LibInfraFundStorage.infraFundStorage().generalConstructors[_gc], "GC Is Not Verified");
        

        charityProject.name = _name;
        charityProject.symbol = _symbol;
        charityProject.proposer = msg.sender;
        charityProject.contractAddress = address(0);
        charityProject.nftAddress = address(0);
        charityProject.gc = _gc;
        charityProject.endOfInvestmentPeriodTime = _endOfInvestmentPeriodTime;
        charityProject.targetAmountOfCapital = _targetAmountOfCapital;
        charityProject.isVerified = false;

        for(uint8 i=0; i < _stages.length; i++ ) {
            charityProject.stages[i].neededFund = 0;
            charityProject.stages[i].proposedFinishTime = 0;
            charityProject.stages[i].KPI = 0;
        }

        LibInfraFundStorage.infraFundStorage().proposals.push(_hashProposal);
        LibInfraFundStorage.infraFundStorage().projectType[_hashProposal] = LibInfraFundStorage.infraFundStorage().CHARITY;

        IERC20(LibInfraFundStorage.infraFundStorage().tokenPayment).transferFrom(msg.sender, address(this), LibInfraFundStorage.infraFundStorage().proposalFee);
        
        emit RegisterCharityProposal(_hashProposal);
    }


    function verifyCharityProposal(string memory _hashProposal, string memory _nftURI) AuditorOnly(msg.sender) external {

        LibInfraFundStorage.CharityProject storage charityProject = LibInfraFundStorage.infraFundStorage().charityProjects[_hashProposal];

        require(charityProject.proposer != address(0), "This Charity Proposal Hash Not Exist");
        require(!charityProject.isVerified, "This Proposal Already Verified");

        charityProject.isVerified = true;

        CharityNFT nftContract = new CharityNFT(charityProject.name , charityProject.symbol);
        charityProject.nftURI = _nftURI;
        
        CharityContract charityContract = new CharityContract(LibInfraFundStorage.infraFundStorage().tokenPayment, address(this), _hashProposal);
        
        charityProject.contractAddress = address(charityContract);
        charityProject.nftAddress = address(nftContract);
        charityProject.nftURI = _nftURI;

        emit VerifyCharityProposal(msg.sender, address(charityContract), _hashProposal);
    }

}
