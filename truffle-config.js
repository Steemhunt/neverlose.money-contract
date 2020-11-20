const dotenv = require('dotenv');
const HDWalletProvider = require('@truffle/hdwallet-provider');

dotenv.config();

const infuraProvider = (network) => {
  return new HDWalletProvider(
    process.env.MNEMONIC,
    `https://${network}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
  )
}

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    test: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    goerli: {
      provider: infuraProvider('goerli'),
      network_id: '5',
      gas: 7000000,
      gasPrice: 5000000000 // 5 gwei
    },
    mainnet: {
      provider: infuraProvider('mainnet'),
      network_id: '1',
      gas: 7000000,
      gasPrice: 31000000000 // 31 gwei
    },
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
      coinmarketcap: '793664cd-7f8f-470f-867b-9de05f7d411d'
      // gasPrice: 25
    }
  },
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  },
  plugins: [
    'truffle-plugin-verify'
  ]
};
