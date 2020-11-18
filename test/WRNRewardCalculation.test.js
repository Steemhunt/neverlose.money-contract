const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const {
  printBlockNumber,
} = require('./helpers/LogHelpers.js');

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
    this.wrnRewardPool.initialize(this.wrn.address, parseInt(await time.latestBlock().valueOf()) + 10, 9999, 9999);
    await this.wrn.addMinter(this.wrnRewardPool.address);
    await this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, 9999999999999, false);
    await this.hunt.approve(this.wrnRewardPool.address, 9999999999999);

    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3);
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
    await time.advanceBlock();

    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
  });

  // Partial started: from < START && to >= START
  it('should not give any WRN reward before start block', async () => {
    // Reward start from +10 blocks
    this.wrnRewardPool = await WRNRewardPool.new();
    const startBlock = parseInt(await time.latestBlock().valueOf()) + 7;
    this.wrnRewardPool.initialize(this.wrn.address, startBlock, 9999, 9999);
    await this.wrn.addMinter(this.wrnRewardPool.address); // +1
    await this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, 9999999999999, false); // +2
    await this.hunt.approve(this.wrnRewardPool.address, 9999999999999); // +3

    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3); // +4
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
    await time.advanceBlockTo(startBlock + 1); // +8
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 0.5);
    await time.advanceBlock(); // +9
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 1);
  });

  // TODO: Partial finished: to > END

  // TODO: Finished: from > END

  // TODO: Bonus: to < BONUS_END

  // TODO: Bonus partial finished: from <= BONUS_END && to > BONUS_END

  // TODO: Bonus finished: from > BONUS_END
});
