const Web3 = require('web3');
const ERC20Token = require('../build/contracts/ERC20Token.json');
require('dotenv').config();

const NETWORK = 'mainnet';
const PRIVATE_KEY = process.env.MAINNET_HOT_PRIVATE_KEY;

// NOTE: Work around for https://github.com/ethereum/web3.js/issues/1965
const getWeb3 = function(){
  const web3 = new Web3(`https://${NETWORK}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
  const account = web3.eth.accounts.privateKeyToAccount('0x' + PRIVATE_KEY);
  web3.eth.accounts.wallet.add(account);

  return web3;
}

const options = function(gasPriceInWei) {
  return {
    gas: '55000',
    from: process.env.MAINNET_HOT_ADDRESS,
    gasPrice: gasPriceInWei
  }
};

const sendHUNT = async function (huntAmount, ethAddress, gasPrice) {
    console.log(`Network: ${NETWORK}`);

    const web3 = getWeb3();
    const gasPriceInWei = web3.utils.toWei(gasPrice, 'gwei');
    const contract = new web3.eth.Contract(
      ERC20Token.abi,
      '0x9AAb071B4129B083B01cB5A0Cb513Ce7ecA26fa5',
      {
        transactionBlockTimeout: 50, // 50 blocks, default: 50
        transactionPollingTimeout: 1800 // 30 minutes, default: 480
      }
    );
    const tokens = web3.utils.toWei(huntAmount.toString(), 'ether');

    return new Promise(async (resolve, reject) => {
      contract.methods.transfer(ethAddress, tokens).send(options(gasPriceInWei))
        .once('transactionHash', async function(hash) {
          console.log(`SENDING ${huntAmount} HUNT -> TX hash:`, hash);
        })
        .on('confirmation', async function(confNumber, receipt) {
          if (confNumber === 1) {
            console.log(`SENT ${huntAmount} HUNT to ${ethAddress}`);
            process.exit(0);
            resolve();
          }
        })
        .on('error', async function(e) {
          console.log(`ERROR while sending ${huntAmount} HUNT to ${ethAddress}! - ${e.message}`);
          // reject(e);
          process.exit(1);
        });
    });
};

sendHUNT('2150', process.argv[2], '34');
