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
  HUNT: '0x853bCea4C256873d848072a207cc07dEf695faC8',
  WETH: '0xf4540e848448AF2357D5ba6210b88CcD8e7B1b4E',
  WBTC: '0xc0f4FC816968283D52a096d951094a9C1c037B13'
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
    await sendETH(owner, to, 10);

    for (let token in tokenAddresses) {
      let amount = 10000 * 50;
      if(token === 'WETH') {
        amount = 10 * 50;
      } else if (token === 'WBTC') {
        amount = 1 * 50;
      }
      await sendToken(token, owner, to, amount);
    }
  } catch (e) {
    console.log('ERROR:' + e.message);
  }

  process.exit(0);
}

sendAll(process.argv[2]);