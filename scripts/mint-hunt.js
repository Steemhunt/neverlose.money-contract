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

async function mint() {
  const contract = new web3.eth.Contract(ERC20Token.abi, '0x853bCea4C256873d848072a207cc07dEf695faC8');
  const owner = (await web3.eth.getAccounts())[0];

  contract.methods.mint(owner, 1000000 + '0'.repeat(18)).send({ from: owner })
    .once('transactionHash', async function(hash) {
      console.log(`Sending - TX: ${hash}`);
    })
    .on('confirmation', async function(confNumber, receipt) {
      if (confNumber === 1) {
        console.log(` => Minted`);
        resolve();
      }
    })
    .on('error', async function(e) {
      reject(e);
    });
}

mint();