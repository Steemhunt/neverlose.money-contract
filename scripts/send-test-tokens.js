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
  HUNT: '0x3cCc84296b4dDf99d628e1472F697c4649A9962F',
  WETH: '0x0370789664eCBc83a9a44766c2384b9d5A638Dfb',
  WBTC: '0xF0aa78e4Ea6C717891085879Bd78Fd87a98D8572'
}

async function sendETH(from, to, amount) {
  return new Promise(async (resolve, reject) => {
    web3.eth.sendTransaction(Object.assign({ to: to, value: amount + '0'.repeat(18) }, { from: from }))
      .once('transactionHash', async function(hash) {
        console.log(`Sending - ${hash}`);
      })
      .on('confirmation', async function(confNumber, receipt) {
        if (confNumber === 1) {
          console.log(` => Sent ${amount} ETH to ${to}`);
          resolve();
        }
      })
      .on('error', async function(e) {
        reject(e);
      });
  });
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

  await sendETH(owner, to , 1);

  for (var token in tokenAddresses) {
    await sendToken(token, owner, to , 1000);
  }

  process.exit(0);
}

sendAll(process.argv[2]);