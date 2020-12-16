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
  HUNT: '0x87f4a557A429C3C45ff9f64640Be8281eC66C27B',
  WETH: '0x0FF90bC7993ed436F03Ca4d93B6a53dBd9C284f1',
  WBTC: '0x01db8A24083c82A7eA95706429bF483908ADF872'
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