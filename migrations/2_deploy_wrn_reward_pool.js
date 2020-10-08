const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const { toBN } = require('../test/helpers/NumberHelpers');

module.exports = async function (deployer, network, [creator]) {
  if (network === 'test') return;

  if (['development', 'ganache'].indexOf(network) > -1) {
    await deployer.deploy(ERC20Token, { from: creator });
    const wrnToken = await ERC20Token.deployed();
    wrnToken.initialize('Neverlose.money', 'WRN', toBN(10000));

    await deployer.deploy(ERC20Token, { from: creator });
    const hunt = await ERC20Token.deployed();
    hunt.initialize('HUNT Token', 'WRN', toBN(10000));

    await deployer.deploy(ERC20Token, { from: creator });
    const weth = await ERC20Token.deployed();
    weth.initialize('Wrapped ETH', 'WETH', toBN(10000));

    await deployer.deploy(ERC20Token, { from: creator });
    const wbtc = await ERC20Token.deployed();
    wbtc.initialize('Wrapped BTC', 'WBTC', toBN(10000));

    await deployer.deploy(WRNRewardPool, { from: creator });
    const wrnRewardPool = await WRNRewardPool.deployed();
    await wrnRewardPool.initialize(wrnToken.address);

    await wrnRewardPool.addLockUpRewardPool(hunt.address, 2, false);
    await wrnRewardPool.addLockUpRewardPool(weth.address, 1, false);
    await wrnRewardPool.addLockUpRewardPool(wbtc.address, 1, false);

    console.log(`WRN: ${wrnToken.address} / WRNRewardPool: ${wrnRewardPool.address}`);
    console.log(` - HUNT: ${hunt.address}\n - WETH: ${weth.address}\n - WBTC: ${wbtc.address}`);
    console.log(`Owner: ${await wrnRewardPool.owner()} / Dev: ${await wrnRewardPool.devAddress()}`);
    console.log(`Sum of reward pool multiplers: ${await wrnRewardPool.totalMultiplier()}`);
    console.log(`Owner HUNT balance: ${await hunt.balanceOf(creator)}`);
  } else if (['ropsten'].indexOf(network) > -1) {
    // TODO:
  } else if (network === 'mainnet') {
    const huntTokenOnMainnet = '0x9aab071b4129b083b01cb5a0cb513ce7eca26fa5';
    // TODO:
  }
}
