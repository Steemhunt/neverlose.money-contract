const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const { toBN } = require('./helpers/NumberHelpers');
const {
  printTokenStats,
  printUserLockUps,
  printWRNStats,
  printWRNEarned,
  printUserWRNReward,
  printBlockNumber,
  printLockUp,
} = require('./helpers/LogHelpers.js');

contract('WRN Reward Pool Test', ([creator, alice, bob]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    await this.hunt.initialize('HuntToken', 'HUNT', 18, toBN(1000));

    this.wrn = await ERC20Token.new({ from: creator });
    await this.wrn.initialize('Warren Token', 'WRN', 18, toBN(0));

    this.wrnRewardPool = await WRNRewardPool.new({ from: creator });
    await this.wrnRewardPool.initialize(this.wrn.address, await time.latestBlock().valueOf(), 8800000, 500000, 1e17);

    // Add minter
    await this.wrn.addMinter(this.wrnRewardPool.address, { from: creator });

    // Add HUNT pool
    await this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, toBN(9999999999999), false);

    await this.hunt.approve(this.wrnRewardPool.address, toBN(1000), { from: creator });

    // give alice and bob some balance and approve
    await this.hunt.mint(alice, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(500), { from: alice });

    await this.hunt.mint(bob, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(500), { from: bob });
  });

  it('addMinter should be only callable by the creator', async () => {
    await expectRevert(
      this.wrn.addMinter(this.wrnRewardPool.address, { from: alice }),
      'ERC20PresetMinterPauser: must have minter role to add a minter'
    );
  });

  // double check for LockUpPool
  it('lock-up function should be paused during emergency mode', async () => {
    await this.wrnRewardPool.setEmergencyMode(true);
    await expectRevert(
      this.wrnRewardPool.doLockUp(this.hunt.address, 1000, 3),
      'NOT_ALLOWED_IN_EMERGENCY'
    );
  });

  it('should not update a non-existing pool info', async () => {
    this.eth = await ERC20Token.new({ from: creator });
    await this.eth.initialize('Ethereum', 'ETH', 18, toBN(1000));

    await expectRevert(this.wrnRewardPool.updatePool(this.eth.address), 'POOL_NOT_FOUND');
  });

  it('should not have any pending WRN for non-existing pool', async () => {
    this.eth = await ERC20Token.new({ from: creator });
    await this.eth.initialize('Ethereum', 'ETH', 18, toBN(1000));

    assert.equal((await this.wrnRewardPool.pendingWRN(this.eth.address, { from: creator })).valueOf(), 0);
  });

  it('rewardMultiplier should be increased', async () => {
    assert.equal((await this.wrnRewardPool.totalMultiplier()).valueOf(), 2);

    this.eth = await ERC20Token.new({ from: creator });
    await this.eth.initialize('Ethereum', 'ETH', 18, toBN(1000));
    await this.wrnRewardPool.addLockUpRewardPool(this.eth.address, 1, toBN(9999999999999), false);

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

  it('should update pending WRN once a block proceeds', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf(), 0);
    await time.advanceBlock();

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.5);
  });

  it('should update pending WRN on multiple accounts properly', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: bob });

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.5);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf(), 0);

    await time.advanceBlock();

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.75);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0.25);
  });

  it('should reward alice 2x since she has 2x more locked up', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(3), 3, { from: alice }); // effective = 3 * 1 = 3
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: bob }); // effective = 1 * 1 = 1
    // Block 1 - alice: 0.5 / bob: 0

    await time.advanceBlock();

    // Block 1 - alice: 0.5 + 0.5 * 3/4 = 0.875 / bob: 0.125

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.875);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0.125);
  });

  it('should calculate duration boost correctly', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 30, { from: alice }); // effective = 1 * 30/3 = 10
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(2), 11, { from: bob }); // effective = 2 * 3 = 6
    // Block 1 - alice: 0.5 / bob: 0

    await time.advanceBlock();

    // Block 1 - alice: 0.5 + 0.5 * 10/16 = 0.8125 / bob: 0.5 * 6/16 = 0.1875

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.8125);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0.1875);
  });

  it('should calculate reward pool multiplier correctly', async () => {
    this.weth = await ERC20Token.new({ from: creator });
    await this.weth.initialize('WETH', 'WETH', 18, toBN(1000));
    await this.weth.mint(bob, toBN(500), { from: creator });
    await this.weth.approve(this.wrnRewardPool.address, toBN(500), { from: bob });

    await this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, toBN(9999999999999), true); // Total pool multiplier = 5

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice }); // 100% on HUNT pool, 0.5 * 2/5 = 0.2 -> HUNT pool
    await this.wrnRewardPool.doLockUp(this.weth.address, toBN(1), 3, { from: bob }); // 100% on WETH pool, 0.5 * 3/5 = 0.3 -> WRETH pool
    // Block 1 - alice: 0.2 / bob: 0

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.2);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.weth.address, { from: bob })).valueOf() / 1e18, 0);

    await time.advanceBlock();

    // Block 2 - alice: 0.2 + 0.2 = 0.4 / bob: 0.3

    // No WRN if not participated
    assert.equal((await this.wrnRewardPool.pendingWRN(this.weth.address, { from: alice })).valueOf() / 1e18, 0);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0);

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.4);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.weth.address, { from: bob })).valueOf() / 1e18, 0.3);
  });

  it('should fail on updating to a smaller multiplier without updating all pool', async () => {
    await expectRevert(
      this.wrnRewardPool.updatePoolMultiplier(this.hunt.address, 1, false),
      'UPDATE_ALL_REQUIRED'
    );
  });

  it('should update reward pool multiplier correctly', async () => {
    this.weth = await ERC20Token.new({ from: creator });
    await this.weth.initialize('WETH', 'WETH', 18, toBN(1000));
    await this.weth.mint(bob, toBN(500), { from: creator });
    await this.weth.approve(this.wrnRewardPool.address, toBN(500), { from: bob });

    await this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, toBN(9999999999999), true); // Total pool multiplier = 5

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice }); // 100% on HUNT pool, 0.5 * 2/5 = 0.2 -> HUNT pool
    await this.wrnRewardPool.doLockUp(this.weth.address, toBN(1), 3, { from: bob }); // 100% on WETH pool, 0.5 * 3/5 = 0.3 -> WRETH pool
    // Block 1 - alice: 0.2 / bob: 0

    await time.advanceBlock();

    // Block 2 - alice: 0.2 + 0.2 = 0.4 / bob: 0.3

    await this.wrnRewardPool.updatePoolMultiplier(this.weth.address, 2, true);

    // Block 3 - alice: 0.2 + 0.2 + 0.2 = 0.6 / bob: 0.3 + 0.3 = 0.6
    // 0.5 * 2/4 = 0.25 -> HUNT Pool
    // 0.5 * 2/4 = 0.25 -> WETH Pool

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.6);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.weth.address, { from: bob })).valueOf() / 1e18, 0.6);

    await time.advanceBlock();

    // Block 3 - alice: 0.2 + 0.2 + 0.2 + 0.25 = 0.85 / bob: 0.3 + 0.3 + 0.25 = 0.85
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.85);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.weth.address, { from: bob })).valueOf() / 1e18, 0.85);
  });

  it('adding a reward pool in the middle of other pools', async () => {
    this.weth = await ERC20Token.new({ from: creator });
    await this.weth.initialize('WETH', 'WETH', 18, toBN(1000));
    await this.weth.mint(bob, toBN(500), { from: creator });
    await this.weth.approve(this.wrnRewardPool.address, toBN(500), { from: bob });

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice }); // 100% on HUNT pool
    // Block 0 - alice: 0
    await this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, toBN(9999999999999), true); // Total pool multiplier = 5
    // Block 1 - alice: 0.5

    // assert.equal((await this.wrn.totalSupply()).valueOf() / 1e18, 0.5 + 0.5/9);

    await this.wrnRewardPool.doLockUp(this.weth.address, toBN(1), 3, { from: bob }); // 100% on WETH pool, 0.5 * 3/5 = 0.3 -> WRETH pool
    // Block 2 - alice: 0.5 + 0.2 = 0.7 / bob: 0

    await time.advanceBlock();

    // Block 3 - alice: 0.5 + 0.2 + 0.2 = 0.9 / bob: 0.3 (total supply: 1.3 instead 1.5)
    // assert.equal((await this.wrn.totalSupply()).valueOf() / 1e18, 1.3 + 0.3/9 );

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.9);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.weth.address, { from: bob })).valueOf() / 1e18, 0.3);
  });

  it('adding a reward pool in the middle of other pools WITH updates', async () => {
    this.weth = await ERC20Token.new({ from: creator });
    await this.weth.initialize('WETH', 'WETH', 18, toBN(1000));

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice }); // 100% on HUNT pool
    // Block 0 - alice: 0
    await this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, toBN(9999999999999), true); // Total pool multiplier becomes 5, but `accWRNPerShare` is not updated
    // Block 1 - alice: 0.5

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.5);

    await time.advanceBlock();
    // Block 2 - alice: 0.5 + 0.2 = 0.7

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.7);

    await this.wrnRewardPool.claimWRN(this.hunt.address, { from: alice });
    // Block 3 - alice: 0.5 + 0.2 + 0.2 = 0.9 (if updated)

    assert.equal((await this.wrn.balanceOf(alice, { from: alice })).valueOf() / 1e18, 0.9);
  });

  it('adding a reward pool in the middle of other pools WITHOUT updates', async () => {
    this.weth = await ERC20Token.new({ from: creator });
    await this.weth.initialize('WETH', 'WETH', 18, toBN(1000));

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice }); // 100% on HUNT pool
    // Block 0 - alice: 0
    await this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, toBN(9999999999999), false); // Total pool multiplier becomes 5, but `accWRNPerShare` is not updated
    // Block 1 - alice: 0.5

    await time.advanceBlock();

    // Block 2 - alice: 0.5 + 0.2 = 0.7 (if updated), but actual value: 0.2 + 0.2 = 0.4

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.4);

    await this.wrnRewardPool.claimWRN(this.hunt.address, { from: alice });
    // Block 3 - alice: 0.5 + 0.2 + 0.2 = 0.9 (if updated), but actual value: 0.2 + 0.2 + 0.2 = 0.6

    assert.equal((await this.wrn.balanceOf(alice, { from: alice })).valueOf() / 1e18, 0.6);
  });

  it('should be able to cliam pending WRN', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);

    await this.wrnRewardPool.claimWRN(this.hunt.address, { from: alice }); // Block 1 - alice: 0.5
    assert.equal((await this.wrn.balanceOf(alice, { from: alice })).valueOf() / 1e18, 0.5);
    assert.equal((await this.wrn.totalSupply()).valueOf() / 1e18, 0.5 + 0.5/9);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);
  });

  it('should distribute penalty and dev pool properly', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice });
    assert.equal((await this.hunt.balanceOf(alice)).valueOf() / 1e18, 400);
    await this.wrnRewardPool.exit(this.hunt.address, 0, true, { from: alice });

    // LockUp pool test again
    assert.equal((await this.hunt.balanceOf(alice)).valueOf() / 1e18, 487);
    assert.equal((await this.hunt.balanceOf(await this.wrnRewardPool.fundAddress().valueOf())).valueOf() / 1e18, 3); // fund
    assert.equal((await this.hunt.balanceOf(this.wrnRewardPool.address)).valueOf() / 1e18, 10); // Penalty should be remained on the contract

    assert.equal((await this.wrn.totalSupply()).valueOf() / 1e18, 0.5 + 0.5/9); // total minted
    assert.equal((await this.wrn.balanceOf(await this.wrnRewardPool.fundAddress().valueOf())).valueOf() / 1e18, 0.5/9); // fund
  });

  it('adding a reward pool in the middle of other pools WITH updates', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: bob });

    // Block 0 - alice: 0.5 / bob: 0

    await time.advanceBlock();

    // Block 1 - alice: 0.75 / bob: 0.25

    await this.wrnRewardPool.exit(this.hunt.address, 0, true, { from: alice });

    // Block 2 - alice: 1.0 (claimed) / bob: 0.5

    await time.advanceBlock();

    // Block 3 - alice: 1.0 (claimed) / bob: 0.5 + 0.5 = 1.0

    // await printWRNStats(this.wrnRewardPool, this.hunt.address);
    // await printUserWRNReward(this.wrnRewardPool, this.hunt.address, alice);

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);
    assert.equal((await this.wrn.balanceOf(alice, { from: alice })).valueOf() / 1e18, 1.0);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 1.0);
  });

  it('calculate WRN reward properly when exit and re-entering', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    await time.advanceBlock();
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.5);

    await this.wrnRewardPool.exit(this.hunt.address, 0, true, { from: alice }); // Exit & Claim
    assert.equal((await this.wrn.balanceOf(alice)).valueOf() / 1e18, 1.0);

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });
    await time.advanceBlock();
    await time.advanceBlock();

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 1.0);

    await this.wrnRewardPool.exit(this.hunt.address, 1, true, { from: alice }); // Exit & Claim

    assert.equal((await this.wrn.balanceOf(alice)).valueOf() / 1e18, 2.5); // 1.0 + 1.5
  });

  it('should calculate WRN reward correctly on multiple lock-ups', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice }); // 100
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(100), 3, { from: bob }); // 100
    // Block 0 - alice: 0.5 / bob - 0

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(200), 9, { from: alice }); // 600
    // Block 1 - alice: 0.75 / bob - 0.25

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);
    assert.equal((await this.wrn.balanceOf(alice)).valueOf() / 1e18, 0.75);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0.25);

    await this.wrnRewardPool.exit(this.hunt.address, 1, true, { from: alice }); // Exit & Claim

    // Total effective lockup: alice - 100 + 600 = 700 / bob - 100
    // Block 2 - alice: 0.75 + 0.5 * 700/800 = 1.1875 (claimed) / bob: 0.25 + 0.5 * 100/800 = 0.3125

    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);
    assert.equal((await this.wrn.balanceOf(alice)).valueOf() / 1e18, 1.1875);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0.3125);

    // Total effective lockup: alice - 100 / bob - 100
    await time.advanceBlock();
    // Block 3 - alice: 0.25 / bob: 0.3125 + 0.25 = 0.8125
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.25);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0.5625);
  });

  it('should be able to cliam pending WRN and bonus at once', async () => {
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice });
    // Block 1 - alice: 0
    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(100), 3, { from: bob });
    // Block 1 - alice: 0.5 / bob: 0
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: alice })).valueOf() / 1e18, 0.5);
    assert.equal((await this.wrnRewardPool.pendingWRN(this.hunt.address, { from: bob })).valueOf() / 1e18, 0);

    await this.wrnRewardPool.exit(this.hunt.address, 0, true, { from: alice });
    // Block 2 - alice: 0.75 / bob: 0.25
    // Penalty generated: +10 HUNT
    assert.equal((await this.wrn.balanceOf(alice)).valueOf() / 1e18, 0.75);
    assert.equal((await this.hunt.balanceOf(alice)).valueOf() / 1e18, 487);

    await this.wrnRewardPool.claimWRNandBonus(this.hunt.address, { from: bob });
    // Block 3 - bob: 0.75

    assert.equal((await this.wrn.balanceOf(bob)).valueOf() / 1e18, 0.75);
    assert.equal((await this.hunt.balanceOf(bob)).valueOf() / 1e18, 410); // 500 - 100 + 10

    // Additional checks (duplicated)
    assert.equal((await this.wrn.totalSupply()).valueOf() / 1e18, 1.5 + 1.5/9);
    const fundAddress = await this.wrnRewardPool.fundAddress().valueOf();
    assert.equal((await this.wrn.balanceOf(fundAddress)).valueOf() / 1e18, 1.5/9);
    assert.equal((await this.hunt.balanceOf(fundAddress)).valueOf() / 1e18, 3);
  });
});
