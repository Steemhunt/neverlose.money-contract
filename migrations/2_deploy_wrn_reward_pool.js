module.exports = async function (deployer, network, [creator]) {
  if (network === 'test') return;

  const ERC20Token = artifacts.require('ERC20Token');
  const WRNRewardPool = artifacts.require('WRNRewardPool');
  const { toBN } = require('../test/helpers/NumberHelpers');

  if (['development', 'ganache', 'ropsten'].indexOf(network) > -1) {
    // REF: https://docs.openzeppelin.com/upgrades-plugins/1.x/truffle-upgrades
    const { deployProxy } = require('@openzeppelin/truffle-upgrades');

    const wrnToken = await deployProxy(ERC20Token, ['TEST WARREN', 'WRN', toBN(100000)], { deployer });
    console.log('Deployed', wrnToken.address);


    // await deployer.deploy(ERC20Token, { from: creator });
    // const wrnToken = await ERC20Token.deployed();
    // wrnToken.initialize('TEST WARREN', 'WRN', toBN(100000));

    // await deployer.deploy(ERC20Token, { from: creator });
    // const hunt = await ERC20Token.deployed();
    // hunt.initialize('TEST HUNT Token', 'HUNT', toBN(100000));

    // await deployer.deploy(ERC20Token, { from: creator });
    // const weth = await ERC20Token.deployed();
    // weth.initialize('TEST Wrapped ETH', 'WETH', toBN(100000));

    // await deployer.deploy(ERC20Token, { from: creator });
    // const wbtc = await ERC20Token.deployed();
    // wbtc.initialize('TEST Wrapped BTC', 'WBTC', toBN(100000));

    // await deployer.deploy(WRNRewardPool, { from: creator });
    // const wrnRewardPool = await WRNRewardPool.deployed();
    // await wrnRewardPool.initialize(wrnToken.address);

    // await wrnToken.addMinter(wrnRewardPool.address, { from: creator });

    // await wrnRewardPool.addLockUpRewardPool(hunt.address, 2, toBN(9999999999999), false);
    // await wrnRewardPool.addLockUpRewardPool(weth.address, 1, toBN(9999999999999), false);
    // await wrnRewardPool.addLockUpRewardPool(wbtc.address, 1, toBN(9999999999999), false);

    // console.log(`WRNRewardPool: ${wrnRewardPool.address}`);
    // console.log(` - WRN: ${wrnToken.address}\n - HUNT: ${hunt.address}\n - WETH: ${weth.address}\n - WBTC: ${wbtc.address}`);
    // console.log(`Owner: ${await wrnRewardPool.owner()} / Dev: ${await wrnRewardPool.devAddress()}`);
    // console.log(`Sum of reward pool multiplers: ${await wrnRewardPool.totalMultiplier()}`);
    // console.log(`Owner HUNT balance: ${await hunt.balanceOf(creator)}`);
  } else if (network === 'mainnet') {
    const huntTokenOnMainnet = '0x9aab071b4129b083b01cb5a0cb513ce7eca26fa5';
    // TODO:
  }
}
