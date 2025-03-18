// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EnergyToken is ERC20 {
    address public crowdFundingContract;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        owner = msg.sender;
    }

    function setCrowdFundingContract(address _crowdFundingContract) external onlyOwner {
        require(_crowdFundingContract != address(0), "Invalid address");
        crowdFundingContract = _crowdFundingContract;
    }

    modifier onlyCrowdFunding() {
        require(msg.sender == crowdFundingContract, "Only crowdfunding contract can mint");
        _;
    }

    function mint(address to, uint256 amount) external onlyCrowdFunding {
        _mint(to, amount);
    }
}

// // EnergyToken: A utility ERC-20 token that only a specific contract can mint
// contract EnergyToken is ERC20, Ownable {
//     address public immutable crowdfundingContract; // Only this contract can mint

//     constructor(
//         string memory name,
//         string memory symbol,
//         address _crowdfundingContract
//     ) ERC20(name, symbol) Ownable(msg.sender) {
//         require(_crowdfundingContract != address(0), "Invalid contract address");
//         crowdfundingContract = _crowdfundingContract; // Set once, immutable
//     }

//     // Only the crowdfunding contract can mint
//     function mint(address to, uint256 amount) external {
//         require(msg.sender == crowdfundingContract, "Only crowdfunding contract can mint");
//         _mint(to, amount);
//     }
// }
