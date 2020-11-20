const { expectRevert } = require('@openzeppelin/test-helpers');
const ERC20Token = artifacts.require('ERC20Token');
const LockUpPool = artifacts.require('LockUpPool');
const { toBN } = require('./helpers/NumberHelpers');

contract('LockUp and Exit', ([creator, alice, bob, carol]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    await this.hunt.initialize('HuntToken', 'HUNT', 18, toBN(10000));

    this.lockUpPool = await LockUpPool.new({ from: creator });
    await this.lockUpPool.initialize();
    await this.lockUpPool.addLockUpPool(this.hunt.address, toBN(9999999999999));

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
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 8, toBN(10000));
    await this.lockUpPool.addLockUpPool(this.wbtc.address, toBN(9999999999999));

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), toBN(8000));
  });

  it('takes penalty and platform fee properly', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator }); // duration boost: 1x
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: alice }); // duration boost: 4x

    // Total lockUp stats
    const [, totalLockUp, effectiveTotalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(totalLockUp.valueOf(), toBN(2000));
    assert.equal(effectiveTotalLockUp.valueOf(), toBN(5000));

    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });

    // My lockUp stats
    const [amount, effectiveAmount] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), toBN(1000));
    assert.equal(effectiveAmount.valueOf(), toBN(1000));
    const [amount1, effectiveAmount1] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, alice, { from: alice }));
    assert.equal(amount1.valueOf(), 0);
    assert.equal(effectiveAmount1.valueOf(), 0);

    // Total lockUp stats
    const [, totalLockUp1, effectiveTotalLockUp1, , totalPenalty, accTotalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address));
    assert.equal(+totalLockUp1, toBN(1000));
    assert.equal(+effectiveTotalLockUp1, toBN(1000));

    assert.equal((await this.hunt.balanceOf(await this.lockUpPool.fundAddress().valueOf())).valueOf(), toBN(30)); // 3% platform fee should go to the fund
    assert.equal((await this.hunt.balanceOf(alice)).valueOf(), toBN(870)); // 10% penalty + 3% platform fees are deducted
    assert.equal(+totalPenalty, toBN(100));
    assert.equal(+accTotalLockUp, toBN(2000));
    // assert.equal(totalPlatformFee, toBN(30)); - not recorded
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
    // will increase fund balance by 870 (13% cut)

    // Penalty: 100 -> Effective Balance: creator - 0 / alice - 1000
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: creator })).valueOf(), 0);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf(), toBN(100));

    await this.lockUpPool.claimBonus(this.hunt.address, { from: creator }); // should claim 0
    await this.lockUpPool.claimBonus(this.hunt.address, { from: alice }); // should claim 100

    assert.equal((await this.hunt.balanceOf(creator)).valueOf(), toBN(7870)); // 7000 + 870
    assert.equal((await this.hunt.balanceOf(alice)).valueOf(), toBN(100)); // 1000 is still locked
    assert.equal((await this.hunt.balanceOf(await this.lockUpPool.fundAddress().valueOf())).valueOf(), toBN(30)); // platform fee: 30

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

    const [, totalLockUp, effectiveTotalLockUp, , totalPenalty, accTotalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(+totalLockUp, toBN(1000));
    assert.equal(+effectiveTotalLockUp, toBN(1000));
    assert.equal(+totalPenalty, toBN(210));
    assert.equal(+accTotalLockUp, toBN(3100));
    // assert.equal(totalPlatformFee.valueOf(), toBN(63)); - not recorded
    // assert.equal(totalClaimed.valueOf(), toBN(100)); - not recorded
  });

  it('lock-up comes later should not affect already earned bonus of former users', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator }); // duration boost: 1x - 1000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: alice }); // duration boost: 4x - 4000
    // Force Exit!
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: creator });
    // will increase creator balance by 870 (13% cut) + 30 (3% platform fee)

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 12, { from: bob }); // duration boost: 4x - 4000

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf(), toBN(100)); // Shouldn't be 50
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf(), 0);
  });

  it('should not earn bonus after exit', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: alice });
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: bob });

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: creator }); // Force Exit!

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 50);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18, 50);

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice }); // Force Exit & Claim bonus
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf(), toBN(920)); // 1000 + 50 - 130

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18, 150);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: creator })).valueOf() / 1e18, 0);
  });

  it('should calculate bonus correctly on re-entering', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: alice });
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: bob });

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: creator }); // Force Exit!

    // Earned: alice - 50 / bob - 50

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice }); // Force Exit & Claim bonus

    // Earned: alice: 0 / bob: - 150
    // Alice Balance - 1000 + 50 - 130 = 920

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1), 3, { from: alice });

    // Alice balance - 919

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: bob }); // Force Exit & Claim bonus
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18, 0);
    assert.equal((await this.hunt.balanceOf(bob)).valueOf(), toBN(1020)); // 1000 + 50 + 100 - 130 = 1020
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 100);

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: bob });
    await this.lockUpPool.exit(this.hunt.address, 1, true, { from: bob }); // Force Exit -> penalty: 10

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 110);

    await this.lockUpPool.claimBonus(this.hunt.address, { from: alice }); // should claim 110
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf() / 1e18, 1029); // 919 + 110

    await this.lockUpPool.exit(this.hunt.address, 1, true, { from: alice }); // Force Exit: withdraw: 0.87 + penalty: 0.1 + fee: 0.03
    assert.equal((await this.hunt.balanceOf(alice, { from: alice })).valueOf(), toBN(102987, 16)); // 1029 + 0.87
  });

  it('should calculate bonus correctly on multiple lock-ups', async () => {
    await this.hunt.transfer(carol, toBN(2000), { from: creator });
    // Balance - creator: 6000
    await this.hunt.approve(this.lockUpPool.address, toBN(9999999999999), { from: carol });

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 3, { from: carol }); // 1000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(1000), 6, { from: carol }); // 2000
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice }); // 100
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: bob }); // 100
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(200), 9, { from: alice }); // 600

    // Total effective lockup: carol - 3000 / alice - 100 + 600 = 700 / bob - 100

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: carol }); // Force Exit! - penalty: 100

    // Earned: carol - 100 * 2000/2800 = 71.4285714286 / alice - 100 * 700/2800 = 25 / bob - 3.5714285714

    assert.equal(((await this.lockUpPool.earnedBonus(this.hunt.address, { from: carol })).valueOf() / 1e18).toFixed(5), '71.42857');
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 25);
    assert.equal(((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18).toFixed(5), '3.57143');

    assert.equal((await this.hunt.balanceOf(await this.lockUpPool.fundAddress().valueOf())).valueOf(), toBN(30)); // platform fee

    await this.lockUpPool.exit(this.hunt.address, 1, true, { from: carol }); // Force Exit! - penalty: 100

    // Earned: alice - 100 * 700/800 = 87.5 / bob - 12.5

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: carol })).valueOf() / 1e18, 0); // Should be claimed
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 112.5); // 25 + 87.5
    assert.equal(((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18).toFixed(5), '16.07143'); // 3.5714285714 + 12.5

    assert.equal((await this.hunt.balanceOf(await this.lockUpPool.fundAddress().valueOf())).valueOf(), toBN(60)); // platform fee

    assert.equal(((await this.hunt.balanceOf(carol)).valueOf() / 1e18).toFixed(5), '1811.42857'); // 2000 - 130 + 71.4285714286 - 130
  });

  it('should calculate bonus debt correctly on multiple lock-ups', async () => {
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice });
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: bob });
    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: bob });

    await this.lockUpPool.exit(this.hunt.address, 1, true, { from: bob }); // Force Exit! - penalty: 10

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 5);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18, 5);

    assert.equal((await this.hunt.balanceOf(bob)).valueOf() / 1e18, 887); // 1000 - 200 + 87

    await this.lockUpPool.doLockUp(this.hunt.address, toBN(100), 3, { from: alice }); // Lock-up & Claim

    // Total effective lockup: alice - 200 / bob: 100

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 0);
    assert.equal((await this.hunt.balanceOf(alice)).valueOf() / 1e18, 805); // 1000 - 100 - 100 + 5
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18, 5); // should be the same

    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: bob }); // Force Exit! - penalty: 10

    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: alice })).valueOf() / 1e18, 10);
    assert.equal((await this.lockUpPool.earnedBonus(this.hunt.address, { from: bob })).valueOf() / 1e18, 0); // claimed 5

    assert.equal((await this.hunt.balanceOf(bob)).valueOf() / 1e18, 979); // 1000 - 200 + 87 + 87 + 5 = 979
  });
});
