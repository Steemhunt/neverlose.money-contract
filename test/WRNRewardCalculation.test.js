const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');

contract('WRN reward calculation in detail', ([creator]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new();
    this.hunt.initialize('HuntToken', 'HUNT', 18, 1000);

    this.wrn = await ERC20Token.new();
    this.wrn.initialize('Warren Token', 'WRN', 18, 0);
  });

  // Not started yet: to < START
  it('should not give any WRN reward before start block', async () => {
    // Reward start from +10 blocks
    this.wrnRewardPool = await WRNRewardPool.new();
    this.wrnRewardPool.initialize(this.wrn.address, await time.latestBlock().valueOf() + 10);
    await this.wrn.addMinter(this.wrnRewardPool.address);
    await this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, 9999999999999, false);
    await this.hunt.approve(this.wrnRewardPool.address, 9999999999999);

    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3);
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
    await time.advanceBlock();

    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
  });

  // TODO: Partial started: from < START && to >= START

  // TODO: Partial finished: to > END

  // TODO: Finished: from > END

  // TODO: Bonus: to < BONUS_END

  // TODO: Bonus partial finished: from <= BONUS_END && to > BONUS_END

  // TODO: Bonus finished: from > BONUS_END
});
