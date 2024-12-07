// require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");
require("@nomiclabs/hardhat-waffle");

task('accounts', 'Prints the list of accounts', async () => {
    const accounts = await ethers.getSigners()
  
    for (const account of accounts) {
      console.log(account.address)
    }
  })
  
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // solidity: "0.7.6",
  solidity: {
    version: '0.8.20',
    settings: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
},

};
