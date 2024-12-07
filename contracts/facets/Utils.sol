// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { verifyIPFS } from "../libraries/LibUtils.sol";


contract Utils {

    function generateHash(string memory contentString) external pure returns(bytes memory) {
        return verifyIPFS.generateHash(contentString);
    }

    function verifyHash(string memory contentString, string memory hash) external pure returns (bool) {
        return verifyIPFS.verifyHash(contentString, hash);
    }
}
