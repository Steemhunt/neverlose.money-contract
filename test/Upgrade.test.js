 const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const WRNRewardPoolV2Test = artifacts.require('WRNRewardPoolV2Test');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { deployProxy, upgradeProxy, admin } = require('@openzeppelin/truffle-upgrades');

contract('WRNRewardPoolV2Test with upgrades plugin', ([creator, alice]) => {
  beforeEach(async () => {
    this.wrn = await deployProxy(ERC20Token, ['TEST WARREN', 'WRN', 18, 1000], { unsafeAllowCustomTypes: true });
    this.hunt = await deployProxy(ERC20Token, ['TEST HUNT', 'HUNT', 18, 1000], { unsafeAllowCustomTypes: true });

    const rewardStartBlock = String(await time.latestBlock().valueOf());
    this.wrnRewardPool = await deployProxy(WRNRewardPool, [this.wrn.address, rewardStartBlock, 8800000, 500000], { unsafeAllowCustomTypes: true });

    await this.wrn.addMinter(this.wrnRewardPool.address);
    await this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, 9999999999999, false);
    await this.hunt.approve(this.wrnRewardPool.address, 9999999999999);
  });

  it('should have the same proxy address', async () => {
    this.wrnRewardPoolV2 = await upgradeProxy(this.wrnRewardPool.address, WRNRewardPoolV2Test, { unsafeAllowCustomTypes: true });
    assert.equal(this.wrnRewardPool.address, this.wrnRewardPoolV2.address);
  });

  it('should disable exit function', async () => {
    this.wrnRewardPoolV2 = await upgradeProxy(this.wrnRewardPool.address, WRNRewardPoolV2Test, { unsafeAllowCustomTypes: true });
    await expectRevert(
      this.wrnRewardPool.exit(this.hunt.address, 0, true), // Should be able to call with the same proxy contract
      'disabled'
    );
  });

  it('should have a new extended variable', async () => {
    this.wrnRewardPoolV2 = await upgradeProxy(this.wrnRewardPool.address, WRNRewardPoolV2Test, { unsafeAllowCustomTypes: true });
    await this.wrnRewardPoolV2.setVarAdded(1234); // Should call with the new V2 contract because this function is added (ABI is changed)
    assert.equal((await this.wrnRewardPoolV2.varAdded()).valueOf(), 1234);
  });

  it('should fail if non-admin user try to upgrade', async () => {
    await admin.changeProxyAdmin(this.wrnRewardPool.address, alice);

    await expectRevert(
      upgradeProxy(this.wrnRewardPool.address, WRNRewardPoolV2Test, { unsafeAllowCustomTypes: true }),
      'Proxy admin is not the one registered in the network manifest'
    );
  });

  // TODO: How can we renounce ownership? - await admin.transferProxyAdminOwnership('0x0000000000000000000000000000000000000000')?
});