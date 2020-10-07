const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const SafeERC20 = artifacts.require('SafeERC20');
const WRNRewardPool = artifacts.require('WRNRewardPool');
const { toBN } = require('./helpers/NumberHelpers');
const {
  printTokenStats,
  printUserLockUps,
  printWRNStats,
  printWRNEarned,
  printUserWRNReward,
  printBlockNumber,
} = require('./helpers/LogHelpers.js');

contract('WRN Reward Pool Test', ([creator, alice, bob, carol]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    this.hunt.initialize('HuntToken', 'HUNT', toBN(1000));

    this.wrn = await ERC20Token.new({ from: creator });
    this.wrn.initialize('WRN', 'WARREN', toBN(0));

    this.wrnRewardPool = await WRNRewardPool.new({ from: creator });
    this.wrnRewardPool.initialize(this.wrn.address);

    // Add minter
    await this.wrn.addMinter(this.wrnRewardPool.address, { from: creator });

    // Add HUNT and ETH to the pool
    this.wrnRewardPool.addLockUpRewardPool(this.hunt.address, 2, false);

    await this.hunt.approve(this.wrnRewardPool.address, toBN(1000), { from: creator });

    // give alice and bob some balance and approve
    await this.hunt.mint(alice, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(500), { from: alice });

    await this.hunt.mint(bob, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(500), { from: bob });

    await this.hunt.mint(carol, toBN(500), { from: creator });
    await this.hunt.approve(this.wrnRewardPool.address, toBN(500), { from: carol });
  });

  it('rewardMultiplier should be increased', async () => {
    assert.equal((await this.wrnRewardPool.totalMultiplier()).valueOf(), 2);

    this.eth = await ERC20Token.new({ from: creator });
    this.eth.initialize('Ethereum', 'ETH', toBN(1000));
    this.wrnRewardPool.addLockUpRewardPool(this.eth.address, 1, false);

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
    this.weth.initialize('WETH', 'WETH', toBN(1000));
    await this.weth.mint(bob, toBN(500), { from: creator });
    await this.weth.approve(this.wrnRewardPool.address, toBN(500), { from: bob });

    this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, false); // Total pool multiplier = 5

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

  it('adding a reward pool in the middle of other pools', async () => {
    this.weth = await ERC20Token.new({ from: creator });
    this.weth.initialize('WETH', 'WETH', toBN(1000));
    await this.weth.mint(bob, toBN(500), { from: creator });
    await this.weth.approve(this.wrnRewardPool.address, toBN(500), { from: bob });

    await this.wrnRewardPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice }); // 100% on HUNT pool
    // Block 0 - alice: 0
    this.wrnRewardPool.addLockUpRewardPool(this.weth.address, 3, true); // Total pool multiplier = 5
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

  // TODO: `addLockUpRewardPool` without updating all pools should not affect on actual claimed values

  // TODO: Check total supply

  // TODO: Claim & After Claim

  // TODO: Exit & After Exit (& Force Exit)
});
