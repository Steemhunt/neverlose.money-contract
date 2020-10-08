const { expectRevert } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const LockUpPool = artifacts.require('LockUpPool');
const { toBN } = require('./helpers/NumberHelpers');

contract('LockUp and Exit', ([creator, alice, bob]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    this.hunt.initialize('HuntToken', 'HUNT', toBN(10000));

    this.lockUpPool = await LockUpPool.new({ from: creator });
    this.lockUpPool.initialize();
    this.lockUpPool.addLockUpPool(this.hunt.address);

    await this.hunt.transfer(alice, toBN(1000), { from: creator });
    await this.hunt.transfer(bob, toBN(1000), { from: creator });

    await this.hunt.approve(this.lockUpPool.address, toBN(9999999999999), { from: creator });
    await this.hunt.approve(this.lockUpPool.address, toBN(9999999999999), { from: alice });
    await this.hunt.approve(this.lockUpPool.address, toBN(9999999999999), { from: bob });

    // - Creator: 9000 / Allowance: 1000
    // - Alice: 1000 / Allowance: 1000
  });

  it('initial values should be correct', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    this.wbtc.initialize('Wrapped BTC', 'wBTC', toBN(10000));
    this.lockUpPool.addLockUpPool(this.wbtc.address);

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), toBN(8000));
  });

  it('should cut penalty and platform fee', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: alice });
    assert.equal((await this.hunt.balanceOf(alice)).valueOf() / 1e18, 0);
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });

    // LockUp pool test again
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf() / 1e18, 870);
  });

  it('takes penalty and platform fee properly', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator }); // duration boost: 1x
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: alice }); // duration boost: 4x

    // Total lockUp stats
    const [, totalLockUp, effectiveTotalLockUp, , ,] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(totalLockUp.valueOf(), toBN(2000));
    assert.equal(effectiveTotalLockUp.valueOf(), toBN(5000));

    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });

    // My lockUp stats
    const [amount, effectiveAmount,,,] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), toBN(1000));
    assert.equal(effectiveAmount.valueOf(), toBN(1000));
    const [amount1, effectiveAmount1,,,] = Object.values(await this.lockUpPool.myLockUp(this.hunt.address, alice, { from: alice }));
    assert.equal(amount1.valueOf(), 0);
    assert.equal(effectiveAmount1.valueOf(), 0);

    // Total lockUp stats
    const [, totalLockUp1, effectiveTotalLockUp1, totalPenalty, totalPlatformFee,] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(totalLockUp1.valueOf(), toBN(1000));
    assert.equal(effectiveTotalLockUp1.valueOf(), toBN(1000));

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), toBN(7030)); // 3% platform fee should go to the contract owner (original balance: 8000)
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf(), toBN(870)); // 10% penalty + 3% platform fees are deducted
    assert.equal(totalPenalty, toBN(100));
    assert.equal(totalPlatformFee, toBN(30));
  });

  it('penalty should be distributed to the participants', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator }); // duration boost: 1x - 1000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: alice }); // duration boost: 4x - 4000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(500), 9, { from: bob }); // duration boost: 3x - 1500
    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });

    // Penalty: 100 -> Effective Balance: creator - 1000 / alice - 0 / bob - 1500
    // - Creator: 100 * 1000 / 2500 = 40
    // - Bob: 100 * 1500 / 2500 = 60
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: creator })).valueOf(), toBN(40));
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf(), 0);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf(), toBN(60));
  });

  it('users can claim and withdraw bonus from panalty pool', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator }); // duration boost: 1x - 1000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: alice }); // duration boost: 4x - 4000
    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: creator });
    // will increase creator balance by 870 (13% cut) + 30 (3% platform fee)

    // Penalty: 100 -> Effective Balance: creator - 0 / alice - 1000
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: creator })).valueOf(), 0);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf(), toBN(100));

    await this.lockUpPool.claimBonus(this.hunt.address, { from: creator }); // should claim 0
    await this.lockUpPool.claimBonus(this.hunt.address, { from: alice }); // should claim 100

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), toBN(7900)); // 7000 + 870 + 30
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf(), toBN(100)); // 1000 is still locked

    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });
    // will increase creator balance by 30 (3% platform fee) + alice's balance by 870 (13% cut)
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf(), toBN(970));

    // Now 100 HUNT cannot be claimed forever!
    // const { tokenStats } = require('./helpers/ContractHelpers.js');
    // console.log(await tokenStats(this.lockUpPool, this.hunt.address));

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: bob });
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf(), 0);

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice });
    await this.lockUpPool.exit(this.hunt.address, 1, true, { from: alice });
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf(), toBN(10));

    const [, totalLockUp, effectiveTotalLockUp, totalPenalty, totalPlatformFee, totalClaimed] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(totalLockUp.valueOf(), toBN(1000));
    assert.equal(effectiveTotalLockUp.valueOf(), toBN(1000));
    assert.equal(totalPenalty.valueOf(), toBN(210));
    assert.equal(totalPlatformFee.valueOf(), toBN(63));
    assert.equal(totalClaimed.valueOf(), toBN(100));
    assert.equal((await this.lockUpPool.totalClaimableBonus(this.hunt.address)).valueOf(), toBN(110));
     // but actually, only 100 is claimable because there was a point when the pool emptied out
  });

  it('lock ups comes later should not affect already earned bonus of former users', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator }); // duration boost: 1x - 1000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: alice }); // duration boost: 4x - 4000
    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: creator });
    // will increase creator balance by 870 (13% cut) + 30 (3% platform fee)

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: bob }); // duration boost: 4x - 4000

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf(), toBN(100)); // Shouldn't be 50
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf(), 0);
  });

  // TODO: Test more complicated situation using 4 or more participants
});
