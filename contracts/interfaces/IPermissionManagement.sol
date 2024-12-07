// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPermissionManagement { 

    function isAuditor(address _auditor) external view returns(bool);
    function registerAuditor(address _newAuditor) external;
    function revokeAuditor(address _auditor) external;

    function isInvestor(address _investor) external view returns(bool); 
    function registerInvestor(address _newInvestor) external;
    function revokeInvestor(address _investor) external;

    function isGC(address _GC) external view returns(bool);
    function registerGC(address _newGC) external;
    function revokeGC(address _GC) external;

    function isClient(address _client) external view returns(bool);
    function registerClient(address _newClient) external;
    function revokeClient(address _client) external;
}
