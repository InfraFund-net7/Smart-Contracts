// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UtilityToken is ERC20 {
    constructor(uint256 _initialSupply) ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, _initialSupply); // Mint 1M USDC to deployer
    }
}
