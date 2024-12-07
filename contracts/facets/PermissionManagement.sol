// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IPermissionManagement } from "../interfaces/IPermissionManagement.sol";
import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";


contract PermissionManagement is IPermissionManagement { 

    event RegisterAuditor(address indexed auditor);
    event RevokeAuditor(address indexed auditor);

    event RegisterInvestor(address indexed investor);
    event RevokeInvestor(address indexed investor);
    
    event RegisterGC(address indexed GC);
    event RevokeGC(address indexed GC);

    event RegisterClient(address indexed client);
    event RevokeClient(address indexed client);

    function isAuditor(address _auditor) external view returns(bool) {
        return LibInfraFundStorage.infraFundStorage().auditors[_auditor]; 
    }

    function registerAuditor(address _newAuditor) external {

        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(!LibInfraFundStorage.infraFundStorage().auditors[_newAuditor], "Auditor Already Exists");

        LibInfraFundStorage.infraFundStorage().auditors[_newAuditor] = true;

        emit RegisterAuditor(_newAuditor);
    }

    function revokeAuditor(address _auditor) external {

        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(LibInfraFundStorage.infraFundStorage().auditors[_auditor], "Auditor Not Exists");

        LibInfraFundStorage.infraFundStorage().auditors[_auditor] = false;

        emit RevokeAuditor(_auditor);
    }

    function isInvestor(address _investor) external view returns(bool) {
        return LibInfraFundStorage.infraFundStorage().investors[_investor]; 
    }

    function registerInvestor(address _newInvestor) external {
            
        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(!LibInfraFundStorage.infraFundStorage().investors[_newInvestor], "Investor Already Exists");

        LibInfraFundStorage.infraFundStorage().investors[_newInvestor] = true;

        emit RegisterInvestor(_newInvestor);
    }

    function revokeInvestor(address _investor) external {

        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(LibInfraFundStorage.infraFundStorage().investors[_investor], "Investor Not Exists");

        LibInfraFundStorage.infraFundStorage().investors[_investor] = false;

        emit RevokeInvestor(_investor);
    }

    function isGC(address _GC) external view returns(bool) {
        return LibInfraFundStorage.infraFundStorage().generalConstructors[_GC]; 
    }

    function registerGC(address _newGC) external {
            
        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(!LibInfraFundStorage.infraFundStorage().generalConstructors[_newGC], "GC Already Exists");

        LibInfraFundStorage.infraFundStorage().generalConstructors[_newGC] = true;

        emit RegisterGC(_newGC);
    }

    function revokeGC(address _GC) external {

        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(LibInfraFundStorage.infraFundStorage().generalConstructors[_GC], "GC Not Exists");

        LibInfraFundStorage.infraFundStorage().generalConstructors[_GC] = false;

        emit RevokeGC(_GC);
    }

    function isClient(address _client) external view returns(bool) {
        return LibInfraFundStorage.infraFundStorage().verifiedClients[_client]; 
    }

    function registerClient(address _newClient) external {
            
        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(!LibInfraFundStorage.infraFundStorage().verifiedClients[_newClient], "Client Already Exists");

        LibInfraFundStorage.infraFundStorage().verifiedClients[_newClient] = true;

        emit RegisterClient(_newClient);
    }

    function revokeClient(address _client) external {

        require(LibDiamond.contractOwner() == msg.sender, "Not Permission");
        require(LibInfraFundStorage.infraFundStorage().verifiedClients[_client], "Client Not Exists");

        LibInfraFundStorage.infraFundStorage().verifiedClients[_client] = false;

        emit RevokeClient(_client);
    }

}
