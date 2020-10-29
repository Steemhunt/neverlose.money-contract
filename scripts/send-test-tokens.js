const Web3 = require('web3');
const ERC20Token = require('../build/contracts/ERC20Token.json');
require('dotenv').config();

const HDWalletProvider = require('@truffle/hdwallet-provider');

const infuraProvider = (network) => {
  return new HDWalletProvider(
    process.env.MNEMONIC,
    `https://eth-${network}.alchemyapi.io/v2/${process.env.ARCHEMY_PROJECT_ID}`
  )
}
const web3 = new Web3(infuraProvider('goerli'));

const tokenAddresses = {
  HUNT: '0x5A43026dE30A2a9539Be2ff315106F4e146Ce59A',
  WETH: '0xb7e94Cce902E34e618A23Cb82432B95d03096146',
  WBTC: '0xE6d830937FA8DB2ebD2c046C58F797A95550fA4E'
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