const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const {
  printBlockNumber,
} = require('./helpers/LogHelpers.js');
const INFINITY = 9999999999999;

async function initializeRewardPool(that, startBlock, rewardBlocks = INFINITY, bonusBlocks = INFINITY) {
  that.wrnRewardPool = await WRNRewardPool.new();
  that.actualStartBlock = +(await time.latestBlock().valueOf()) + startBlock;
  await that.wrnRewardPool.initialize(that.wrn.address, that.actualStartBlock, rewardBlocks, bonusBlocks, 1e17); // +1
  await that.wrn.addMinter(that.wrnRewardPool.address);  // +2
  await that.wrnRewardPool.addLockUpRewardPool(that.hunt.address, 2, INFINITY, false);  // +3
  await that.hunt.approve(that.wrnRewardPool.address, INFINITY);  // +4
}

contract('WRN reward calculation in detail', ([creator]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new();
    await this.hunt.initialize('HuntToken', 'HUNT', 18, 1000);

    this.wrn = await ERC20Token.new();
    await this.wrn.initialize('Warren Token', 'WRN', 18, 0);
  });

  // Not started yet: to < START
  it('should not give any WRN reward before start block', async () => {
    const startBlock = 10;
    await initializeRewardPool(this, startBlock); // block: +4

    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3);
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
    await time.advanceBlock();

    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
  });

  // Partial started: from < START && to >= START
  it('should give WRN from the start block', async () => {
    const startBlock = 7;
    await initializeRewardPool(this, startBlock); // block: +4

    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3); // +4
    await time.advanceBlock(); // +5
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf(), 0);
    await time.advanceBlockTo(this.actualStartBlock + 1); // +8
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 0.5);
    await time.advanceBlock(); // +9
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 1);
  });

  // reward started before the first user joined
  it('should not give extra WRN even if reward started before the first user joined', async() => {
    const startBlock = -10;
    await initializeRewardPool(this, startBlock); // block: +4

    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3); // +6
    await time.advanceBlock(); // +7
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 0.5); // 1 block reward
  });

  // Finished: from > END
  it('should not give WRN after the end block', async () => {
    const startBlock = 0;
    const rewardBlocks = 5;
    const bonusBlocks = 2;
    await initializeRewardPool(this, startBlock, rewardBlocks, bonusBlocks); // block: +4
    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3); // +5
    await time.advanceBlock(); // +6
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 0);
  });

  // Bonus finished: from > BONUS_END
  it('should not give WRN after the end block', async () => {
    const startBlock = 0;
    const rewardBlocks = 10;
    const bonusBlocks = 2;
    await initializeRewardPool(this, startBlock, rewardBlocks, bonusBlocks); // block: +4
    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3); // +5
    await time.advanceBlock(); // +6
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 0.1);
  });

  // Partial bonus finished + Partial finished: from < BONUS_END < to < END
  it('should not give WRN after the end block', async () => {
    const startBlock = 0;
    const rewardBlocks = 12;
    const bonusBlocks = 8;
    await initializeRewardPool(this, startBlock, rewardBlocks, bonusBlocks); // block: +4
    await this.wrnRewardPool.doLockUp(this.hunt.address, 100, 3); // +5
    await time.advanceBlock(); // +6
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 0.5);
    await time.advanceBlock(); // +7
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 1);
    await time.advanceBlock(); // +8
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 1.5);
    await time.advanceBlock(); // +9
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 1.6);
    await time.advanceBlockTo(this.actualStartBlock + 20);

    // Reward = (8-5) * 0.5 + (12-8) * 0.1 + (20-12) * 0 = 1.2
    assert.equal(await this.wrnRewardPool.pendingWRN(this.hunt.address).valueOf() / 1e18, 1.9);
  });
});
