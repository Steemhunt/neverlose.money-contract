module.exports = async function (deployer, network, [creator]) {
  if (network === 'test') return;

  const ERC20Token = artifacts.require('ERC20Token');
  const WRNRewardPool = artifacts.require('WRNRewardPool');
  const { toBN } = require('../test/helpers/NumberHelpers');

  if (['development', 'ganache', 'goerli'].indexOf(network) > -1) {
    // REF: https://docs.openzeppelin.com/upgrades-plugins/1.x/truffle-upgrades
    const { deployProxy } = require('@openzeppelin/truffle-upgrades');

    // NOTE: Use of `unsafeAllowCustomTypes` as UpgradesPlugins currently do not support validating custom types (enums or structs)
    // REF: https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#what-does-it-mean-for-an-implementation-to-be-compatible

    const wrnToken = await deployProxy(ERC20Token, ['TEST WARREN', 'WRN', 18, toBN(100000)], { deployer, unsafeAllowCustomTypes: true });
    const hunt = await deployProxy(ERC20Token, ['TEST HUNT Token', 'HUNT', 18, toBN(100000)], { deployer, unsafeAllowCustomTypes: true });
    const weth = await deployProxy(ERC20Token, ['TEST Wrapped ETH', 'WETH', 18, toBN(100000)], { deployer, unsafeAllowCustomTypes: true });
    const wbtc = await deployProxy(ERC20Token, ['TEST Wrapped BTC', 'WBTC', 8, toBN(100000, 8)], { deployer, unsafeAllowCustomTypes: true });

    const wrnRewardPool = await deployProxy(WRNRewardPool, [wrnToken.address], { deployer, unsafeAllowCustomTypes: true });

    await wrnToken.addMinter(wrnRewardPool.address, { from: creator });

    await wrnRewardPool.addLockUpRewardPool(hunt.address, 2, toBN(10000), false);
    await wrnRewardPool.addLockUpRewardPool(weth.address, 1, toBN(10000), false);
    await wrnRewardPool.addLockUpRewardPool(wbtc.address, 1, toBN(10000, 8), false);

    console.log(`- Contract: ${wrnRewardPool.address}`);
    console.log('- Test tokens');
    console.log(`   - WRN: ${wrnToken.address}\n  - HUNT: ${hunt.address}\n  - WETH: ${weth.address}\n  - WBTC: ${wbtc.address}`);
    console.log(`Owner: ${await wrnRewardPool.owner()} / Dev: ${await wrnRewardPool.devAddress()}`);
    console.log(`Sum of reward pool multiplers: ${await wrnRewardPool.totalMultiplier()}`);
    console.log(`Owner HUNT balance: ${await hunt.balanceOf(creator)}`);
  } else if (network === 'mainnet') {
    const huntTokenOnMainnet = '0x9aab071b4129b083b01cb5a0cb513ce7eca26fa5';
    // TODO:
  }
}
