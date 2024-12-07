// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import { LibInfraFundStorage } from "../libraries/LibInfraFundStorage.sol";

interface ICharityData {

    function projectData(string memory hashProposal) external view returns(LibInfraFundStorage.CharityProject memory);
}