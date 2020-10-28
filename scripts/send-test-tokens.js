const Web3 = require('web3');
const ERC20Token = require('../build/contracts/ERC20Token.json');
require('dotenv').config();

const HDWalletProvider = require('@truffle/hdwallet-provider');

const infuraProvider = (network) => {
  return new HDWalletProvider(
    process.env.MNEMONIC,
    `https://${network}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
  )
}
const web3 = new Web3(infuraProvider('goerli'));

const tokenAddresses = {
  HUNT: '0xe69109b276F653a4DC2E14CBD2855b718e85188D',
  WETH: '0x38F94CB5C245733bA5863f09F5e841fB595B2961',
  WBTC: '0x4605e90c7778E7c97a85D2cA336b7f8de5d90715'
}

async function sendToken(token, from, to, amount) {
  const contract = new web3.eth.Contract(ERC20Token.abi, tokenAddresses[token]);
  const decimals = token == 'WBTC' ? 8 : 18;

  return new Promise(async (resolve, reject) => {
    contract.methods.transfer(to, amount + '0'.repeat(decimals)).send({ from: from })
      .once('transactionHash', async function(hash) {
        console.log(`Sending - TX: ${hash}`);
      })
      .on('confirmation', async function(confNumber, receipt) {
        if (confNumber === 1) {
          console.log(` => Sent ${amount} ${token} to ${to}`);
          resolve();
        }
      })
      .on('error', async function(e) {
        reject(e);
      });
  });
}

async function sendAll(to) {
  if (!to) {
    console.log('INVALID PARAMETER');
    process.exit(1);
  }
  const owner = (await web3.eth.getAccounts())[0];
  console.log(`Owner address: ${owner}`);

  for (var token in tokenAddresses) {
    await sendToken(token, owner, to , 1000);
  }

  process.exit(0);
}

sendAll(process.argv[2]);