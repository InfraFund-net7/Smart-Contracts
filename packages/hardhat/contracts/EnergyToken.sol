// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EnergyToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}




// pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// contract EnergyToken is ERC20 {
//     address public crowdFundingContract;
//     address public owner;

//     modifier onlyOwner() {
//         require(msg.sender == owner, "Not the owner");
//         _;
//     }

//     constructor(string memory name, string memory symbol) ERC20(name, symbol) {
//         owner = msg.sender;
//     }

//     function setCrowdFundingContract(address _crowdFundingContract) external onlyOwner {
//         require(_crowdFundingContract != address(0), "Invalid address");
//         crowdFundingContract = _crowdFundingContract;
//     }

//     modifier onlyCrowdFunding() {
//         require(msg.sender == crowdFundingContract, "Only crowdfunding contract can mint");
//         _;
//     }

//     function mint(address to, uint256 amount) external onlyCrowdFunding {
//         _mint(to, amount);
//     }

//     function burnFrom(address account, uint256 amount) external {
//     require(account != address(0), "Invalid address");
//     require(balanceOf(account) >= amount, "Insufficient balance");
//     require(allowance(account, msg.sender) >= amount, "Allowance too low");

//     _approve(account, msg.sender, allowance(account, msg.sender) - amount);
//     _burn(account, amount);
// }

// }
