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
  HUNT: '0xD409b07cC381c3D831F7fD71C4141c86DdC2a5c6',
  WETH: '0x608f8CeB3Af57Dd3b56b480B51dcfd7E7096acA3',
  WBTC: '0x48A32932F3BD2Fd7Bb31c97570290dE9d1e8827C'
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

  try {
    await sendETH(owner, to, 1);

    for (let token in tokenAddresses) {
      let amount = 500000;
      if(token === 'WETH') {
        amount = 40;
      } else if (token === 'WBTC') {
        amount = 1;
      }
      await sendToken(token, owner, to, amount);
    }
  } catch (e) {
    console.log('ERROR:' + e.message);
  }

  process.exit(0);
}

sendAll(process.argv[2]);