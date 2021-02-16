const dotenv = require('dotenv');
const HDWalletProvider = require('@truffle/hdwallet-provider');

dotenv.config();

module.exports = {
  networks: {
    bsctest: {
      provider: () => new HDWalletProvider(process.env.BSC_MNEMONIC, `https://data-seed-prebsc-1-s1.binance.org:8545`),
      network_id: 97,
      confirmations: 3,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    bscmain: {
      provider: () => new HDWalletProvider(process.env.BSC_MNEMONIC, `https://bsc-dataseed.binance.org`),
      network_id: 56,
      confirmations: 3,
      timeoutBlocks: 200,
      skipDryRun: true
    }
  },
  compilers: {
    solc: {
      version: "0.7.1",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1500
        }
      }
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      coinmarketcap: '793664cd-7f8f-470f-867b-9de05f7d411d',
      gasPrice: 20
    }
  },
  api_keys: {
    bscscan: process.env.BSCSCAN_API_KEY
  },
  plugins: [
    'truffle-plugin-verify'
  ]
};
