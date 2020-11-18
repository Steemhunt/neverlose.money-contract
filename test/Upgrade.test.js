const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const WRNRewardPoolV2Test = artifacts.require('WRNRewardPoolV2Test');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

contract('WRNRewardPoolV2Test with upgrades plugin', ([creator, alice]) => {
  beforeEach(async () => {
    this.wrn = await deployProxy(ERC20Token, ['TEST WARREN', 'WRN', 18, 1000], { unsafeAllowCustomTypes: true });
    this.hunt = await deployProxy(ERC20Token, ['TEST HUNT', 'HUNT', 18, 1000], { unsafeAllowCustomTypes: true });

    const rewardStartBlock = String(await time.latestBlock().valueOf());
    this.wrnRewardPool = await deployProxy(WRNRewardPool, [this.wrn.address, rewardStartBlock, 8800000, 500000], { unsafeAllowCustomTypes: true });

    await this.wrn.addMinter(this.wrnRewardPool.address);
    await this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, 9999999999999, false);
    await this.hunt.approve(this.wrnRewardPool.address, 9999999999999);

    this.wrnRewardPoolV2 = await upgradeProxy(this.wrnRewardPool.address, WRNRewardPoolV2Test, { unsafeAllowCustomTypes: true });
  });

  it('should have the same proxy address', async () => {
    assert.equal(this.wrnRewardPool.address, this.wrnRewardPoolV2.address);
  });

  it('should disable exit function', async () => {
    await expectRevert(
      this.wrnRewardPool.exit(this.hunt.address, 0, true), // Should be able to call with the same proxy contract
      'disabled'
    );
  });

  it('should have a new extended variable', async () => {
    await this.wrnRewardPoolV2.setVarAdded(1234); // Should call with the new V2 contract because this function is added (ABI is changed)
    assert.equal((await this.wrnRewardPoolV2.varAdded()).valueOf(), 1234);
  });
});