const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const SafeERC20 = artifacts.require('SafeERC20');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const { toBN } = require('./helpers/NumberHelpers');
const { printTokenStats, printWRNEarned } = require('./helpers/LogHelpers.js');

contract('WRN Reward Pool Test', ([creator, alice, bob, carol]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    this.hunt.initialize('HuntToken', 'HUNT', toBN(1000));

    this.wrn = await ERC20Token.new({ from: creator });
    this.wrn.initialize('WRN', 'WARREN', toBN(1000));

    this.wrnRewardPool = await WRNRewardPool.new({ from: creator });
    this.wrnRewardPool.initialize(this.wrn.address);

    // Add minter
    await this.wrn.addMinter(this.wrnRewardPool.address, { from: creator });

    // Add HUNT and ETH to the pool
    this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2);

    await this.hunt.approve(this.wrnRewardPool.address, toBN(1000), { from: creator });

    // give alice and bob some balance and approve
    await this.hunt.mint(alice, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(1000), { from: alice });

    await this.hunt.mint(bob, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(1000), { from: bob });

    await this.hunt.mint(carol, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(1000), { from: carol });
  });

  it('rewardMultiplier should be increased', async () => {
    assert.equal((await this.wrnRewardPool.totalMultiplier()).valueOf(), 2);

    this.eth = await ERC20Token.new({ from: creator });
    this.eth.initialize('Ethereum', 'ETH', toBN(1000));
    this.wrnRewardPool.addLockUpRewardPool(this.eth.address, 1);

    assert.equal((await this.wrnRewardPool.totalMultiplier()).valueOf(), 3);
  });

  it('should give initial supply to the creator', async () => {
    assert.equal(
      (await this.hunt.balanceOf(creator, { from: creator })).valueOf(),
      toBN(1000)
    );
  });

  it('should approve 10000 hunt allowance to the reward pool', async () => {
    await this.hunt.approve(this.wrnRewardPool.address, '10000', { from: creator });

    assert.equal(
      (await this.hunt.allowance(creator, this.wrnRewardPool.address, { from: creator })).valueOf(),
      '10000'
    );
  });

  it('should have earned of 0 before staking', async () => {
    assert.equal(
      (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: creator })).valueOf(),
      '0'
    );
  });

  it('should reward alice and bob equally after they stake the same amount', async () => {
    console.log('--------------before alice lockup:', (await this.wrnRewardPool.getBlockTimestamp()).valueOf().toString())

    assert.equal((await this.wrnRewardPool.myEffectiveLockUpTotal(this.hunt.address, { from: alice })).valueOf(), 0);
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    assert.equal((await this.wrnRewardPool.myEffectiveLockUpTotal(this.hunt.address, { from: alice })).valueOf(), toBN(1));

    console.log('--------------before bob lockup:', (await this.wrnRewardPool.getBlockTimestamp()).valueOf().toString())
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: bob });

    // FIXME: Randomly fails!!
    await printTokenStats(this.wrnRewardPool, this.hunt.address);
    await printWRNEarned(this.wrnRewardPool, this.hunt.address, [alice, bob]);
    //---------------------------

    console.log('--------------after1:', (await this.wrnRewardPool.getBlockTimestamp()).valueOf().toString())

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf(), 0);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf(), 0);

    console.log('--------------after2:', (await this.wrnRewardPool.getBlockTimestamp()).valueOf().toString())

    await time.advanceBlock();

    console.log('--------------1sec passed:', (await this.wrnRewardPool.getBlockTimestamp()).valueOf().toString())

    assert.equal(
      (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf().toString(),
      (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf().toString()
    );
  });

  it('should reward alice 2x since she has 2x more locked up', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(2), 3, { from: alice });
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: bob });

    // FIXME: Randomly fails!!
    await printTokenStats(this.wrnRewardPool, this.hunt.address);
    await printWRNEarned(this.wrnRewardPool, this.hunt.address, [alice, bob]);
    //---------------------------
    assert.equal(
      +(await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf().toString(),
      2 * +(await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf().toString()
    );
  });

  it('should reward proportionally after some time', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });

    await time.advanceBlock();

    let aliceEarnedInOneSecond = (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf().toString();

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: bob });

    // here alice has 1/3, and bob has 1/3 of the pool.
    await time.advanceBlock();
    // after one second, alice should have what bob earned + she earned in one second

    let aliceEarned = (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf().toString();
    const bobEarnedInOneSecond = (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf().toString();
    assert.equal(+bobEarnedInOneSecond + +aliceEarnedInOneSecond, +aliceEarned);

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: carol });

    // here alice has 1/4, and bob has 1/4 of the pool, and carol has 1/4 of the pool.
    await time.advanceBlock();
    // after one second, bob should have what carol earned + he earned in one second

    let bobEarned = (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf().toString();
    let carolEarned = (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: carol })).valueOf().toString();
    aliceEarned = (await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf().toString();

    // FIXME: Randomly fails!!
    await printTokenStats(this.wrnRewardPool, this.hunt.address);
    await printWRNEarned(this.wrnRewardPool, this.hunt.address, [alice, bob, carol]);
    //---------------------------
    assert.equal(+bobEarned, +carolEarned + +bobEarnedInOneSecond);

    assert.equal(+aliceEarned,
      +carolEarned + // what alice earned in phase 3
      +bobEarnedInOneSecond + //what alice earned in phase 2
      +aliceEarnedInOneSecond // what alice initially earned
    );
  });

  // TODO: Claim & After Claim

  // TODO: Exit & After Exit (& Force Exit)
});
