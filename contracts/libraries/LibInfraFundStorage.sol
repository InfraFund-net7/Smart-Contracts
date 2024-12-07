    // SPDX-License-Identifier: MIT
    pragma solidity 0.8.20;


    library LibInfraFundStorage {

        bytes32 constant STORAGE_POSITION = keccak256("infrafund.storage");
        
        struct CharityProject{
            string name;
            string symbol;
            address proposer;
            address gc;
            address contractAddress;
            address nftAddress;
            string nftURI;
            uint256 endOfInvestmentPeriodTime;
            uint256 targetAmountOfCapital;
            GCStages[] stages;
            bool isVerified;
        }
        struct LoanProject{
            string name;
            string symbol;
            address proposer;
            address contractAddress;
            address gc;
            uint256 startTime;
            uint256 investmentPeriod;
            uint256 targetAmount;
            GCStages[] stages;
            bool isVerified;
            bool exist;
        }
        struct PresellProject{
            string name;
            string symbol;
            address proposer;
            address contractAddress;
            address gc;
            uint256 startTime;
            uint256 investmentPeriod;
            uint256 targetAmount;
            GCStages[] stages;
            bool isVerified;
            bool exist;
        }
        struct SecurityTokenProject{
            string name;
            string symbol;
            address proposer;
            address contractAddress;
            address gc;
            uint256 startTime;
            uint256 investmentPeriod;
            uint256 targetAmount;
            GCStages[] stages;
            bool isVerified;
            bool exist;
        }
    struct GCStages {
        uint256 neededFund;
        uint256 proposedFinishTime;
        uint256 KPI;
        uint256 neededExtraFund;
        string proposalHashForExtraFund;
        bool isClaimed;
        bool isVerfied;
        bool isClaimedExtraFund;
        bool isVerfiedExtraFund;
    }
        struct AddressStruct {
            address infraFundAddress;
            address proposer;
            address nftAddress;
            address gc;
            address tokenPayment;
        }        
        struct StringStruct {
            string hashProposal;
            string symbol;
            string nftURI;
            string name;
        }

        struct TickerSymbolDetail {
            address sender;
            uint256 reservedTime;
        }

        // event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

        // function setContractOwner(address _newOwner) internal {
        //     InfraFundStorage storage ds = infraFundStorage();
        //     address previousOwner = ds.contractOwner;
        //     ds.contractOwner = _newOwner;
        //     emit OwnershipTransferred(previousOwner, _newOwner);
        // }

        // function contractOwner() internal view returns (address contractOwner_) {
        //     contractOwner_ = infraFundStorage().contractOwner;
        // }

        // function enforceIsContractOwner() internal view {
        //     require(msg.sender == infraFundStorage().contractOwner, "LibDiamond: Must be contract owner");
        // }


        modifier AuditorOnly(address _auditor) {
            require(infraFundStorage().auditors[_auditor], "Your Not Auditor");
            _;
        }

        modifier InvestorOnly(address _investor) {
            require(infraFundStorage().investors[_investor], "Your Not Investor");
            _;
        }

        modifier GCOnly(address _gc) {
            require(infraFundStorage().generalConstructors[_gc], "Your Not GC");
            _;
        }
        
        modifier ClientOnly(address _client) {
            require(infraFundStorage().verifiedClients[_client], "Your Not Client");
            _;
        }


        struct InfraFundStorage {

            uint8 CHARITY;
            uint8 LOAN;
            uint8 PRESELL;
            uint8 SECURITY_TOKEN;

            string[] proposals;
            uint256 proposalFee;
            uint256 totalInvestment;

            mapping(string => TickerSymbolDetail) reservedSymbols;

            mapping(address => bool) verifiedClients;
            mapping(address => bool) auditors;
            mapping(address => bool) investors;
            mapping(address => bool) generalConstructors;

            mapping(string => uint256) projectBalance;
            mapping(string => mapping(address => uint256)) amountOfInvestment;
            // mapping(address => string[]) listProjectsPerAddress;
    
            mapping(string => uint8) projectType;
            mapping(string => CharityProject) charityProjects;
            mapping(string => LoanProject) loanProjects;
            mapping(string => PresellProject) presellProjects;
            mapping(string => SecurityTokenProject) securityProjects;
            
            address contractOwner;
            address tokenPayment;
        }


        function infraFundStorage() internal pure returns (InfraFundStorage storage st) {
            bytes32 position = STORAGE_POSITION;
            assembly {
                st.slot := position
            }
        }
    }