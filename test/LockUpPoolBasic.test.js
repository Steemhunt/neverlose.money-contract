const ERC20Token = artifacts.require('ERC20Token');
const LockUpPool = artifacts.require('LockUpPool');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { toBN } = require('./helpers/NumberHelpers');

contract('Basic contract functionality', ([creator, alice]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    await this.hunt.initialize('HuntToken', 'HUNT', 18, 10000);

    this.lockUpPool = await LockUpPool.new({ from: creator });
    await this.lockUpPool.initialize();

    await this.lockUpPool.addLockUpPool(this.hunt.address, toBN(9999999999999));

    this.SECONDS_IN_MONTH = +(await this.lockUpPool.SECONDS_IN_MONTH().valueOf());
  });

  it('balance of creator should have initial supply', async () => {
    assert.equal(
      (await this.hunt.balanceOf(creator, { from: creator })).valueOf(),
      10000
    );
  });

  it('initial allowance should be 0', async () => {
    assert.equal(
      (await this.hunt.allowance(creator, this.lockUpPool.address, { from: creator })).valueOf(),
      0
    );
  });

  it('approve should increase allowance', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    assert.equal(
      (await this.hunt.allowance(creator, this.lockUpPool.address, { from: creator })).valueOf(),
      1000
    );
  });

  it('should fail on invalid token address', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 8, 10000);

    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await expectRevert(this.lockUpPool.doLockUp(this.wbtc.address, 1000, 9, { from: creator }), 'POOL_NOT_FOUND');
  });

  it('should fail on lack of balance or allowance', async () => {
    await expectRevert(this.lockUpPool.doLockUp(this.hunt.address, 10001, 9, { from: creator }), 'SafeERC20: low-level call failed');
    await expectRevert(this.lockUpPool.doLockUp(this.hunt.address, 1000, 9, { from: creator }), 'SafeERC20: low-level call failed');
  });

  it('lock up asset properly', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 9, { from: creator });

    // My lockUp stats
    const [amount, effectiveAmount,,,] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), 1000);
    assert.equal(effectiveAmount.valueOf(), 3000);

    // Total lockUp stats
    const [, totalLockUp, effectiveTotalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(totalLockUp.valueOf(), 1000);
    assert.equal(effectiveTotalLockUp.valueOf(), 3000);
  });

  it('calculates duration boost properly = 3 months', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 3, { from: creator });

    const [amount, effectiveAmount,,,] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), 1000);
    assert.equal(effectiveAmount.valueOf(), 1000);
  });

  it('calculates duration boost properly > 3 months', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 120, { from: creator });

    const [amount, effectiveAmount,,,] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), 1000);
    assert.equal(effectiveAmount.valueOf(), 40000);
  });

  it('calculates duration boost properly > 10 years', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });

    await expectRevert(
      this.lockUpPool.doLockUp(this.hunt.address, 1000, 121, { from: creator }),
      'INVALID_DURATION'
    );

    await expectRevert(
      this.lockUpPool.doLockUp(this.hunt.address, 1000, 2, { from: creator }),
      'INVALID_DURATION'
    );
  });

  it('calculates duration boost properly if the duration is not divided by 3', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 17, { from: creator }); // boost: 5

    const [amount, effectiveAmount,,,] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), 1000);
    assert.equal(effectiveAmount.valueOf(), 5000);
  });

  it('should calculate lock-up amount properly on matured lock-ups', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 3, { from: creator });

    await time.increase(this.SECONDS_IN_MONTH * 4);

    await this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator });

    // My lockUp stats
    const [amount, effectiveAmount,,,] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator, { from: creator }));
    assert.equal(amount.valueOf(), 0);
    assert.equal(effectiveAmount.valueOf(), 0);

    // Total lockUp stats
    const [, totalLockUp, effectiveTotalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(totalLockUp.valueOf(), 0);
    assert.equal(effectiveTotalLockUp.valueOf(), 0);
  });

  it('should cut penalty and platform fee', async () => {
    await this.hunt.transfer(alice, 10000, { from: creator });
    await this.hunt.approve(this.lockUpPool.address, 10000, { from: alice });
    await this.lockUpPool.doLockUp(this.hunt.address, 10000, 3, { from: alice });
    assert.equal((await this.hunt.balanceOf(alice)).valueOf(), 0);
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });

    assert.equal((await this.hunt.balanceOf(alice)).valueOf(), 8700);
    assert.equal((await this.hunt.balanceOf(await this.lockUpPool.fundAddress().valueOf())).valueOf(), 300); // platform fee

    const [, unlockedAt, , , exitedAt] = Object.values(await this.lockUpPool.getLockUp(this.hunt.address, alice, 0));
    assert.equal(unlockedAt > exitedAt, true);
  });

  it('should calculate unlockedAt properly', async () => {
    await this.hunt.transfer(alice, 10000, { from: creator });
    await this.hunt.approve(this.lockUpPool.address, 10000, { from: alice });
    await this.lockUpPool.doLockUp(this.hunt.address, 10000, 120, { from: alice });

    const lockedUpAt = (await this.lockUpPool.lockedUpAt(this.hunt.address, alice, 0)).valueOf();
    const [, unlockedAt] = Object.values(await this.lockUpPool.getLockUp(this.hunt.address, alice, 0));

    assert.equal(+lockedUpAt + 120 * 2592000, +unlockedAt);
  });

  it('should not cut any fee on matured lockup', async () => {
    await this.hunt.approve(this.lockUpPool.address, 10000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 10000, 3, { from: creator });
    await time.increase(this.SECONDS_IN_MONTH * 4);
    await this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator });

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), 10000);

    const [, unlockedAt, , , exitedAt] = Object.values(await this.lockUpPool.getLockUp(this.hunt.address, creator, 0));
    assert.equal(unlockedAt < exitedAt, true);
  });

  it('should handle double-exits properly', async () => {
    await this.hunt.approve(this.lockUpPool.address, 10000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 10000, 3, { from: creator });
    await time.increase(this.SECONDS_IN_MONTH * 4);
    await this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator });

    await expectRevert(
      this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator }),
      'ALREADY_EXITED'
    );

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), 10000);
  });

  it('owner should be able to add a pool', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 8, 10000);
    await this.lockUpPool.addLockUpPool(this.wbtc.address, toBN(123, 8));

    const [maxLockUpLimit, totalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.wbtc.address, { from: creator }));

    assert.equal(maxLockUpLimit / 1e8, 123);
    assert.equal(totalLockUp, 0);
  });

  it('non-owner should not be able to add a pool', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 8, 10000);

    await expectRevert(
      this.lockUpPool.addLockUpPool(this.wbtc.address, toBN(123, 8), { from: alice}),
      'Ownable: caller is not the owner.'
    );
  });

  it('only owner should be able to update max limit', async () => {
    await this.lockUpPool.updateMaxLimit(this.hunt.address, toBN(456));
    const [maxLockUpLimit] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address));
    assert.equal(maxLockUpLimit / 1e18, 456);

    await expectRevert(
      this.lockUpPool.updateMaxLimit(this.hunt.address, toBN(789), { from: alice }),
      'Ownable: caller is not the owner.'
    );

    const [maxLockUpLimit2] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address));
    assert.equal(maxLockUpLimit2 / 1e18, 456);
  });

  it('should not allow lock-up more than the max limit', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000);

    await this.lockUpPool.updateMaxLimit(this.hunt.address, 100);
    await this.lockUpPool.doLockUp(this.hunt.address, 100, 3);
    const [amount] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator));
    assert.equal(amount, 100);

    await expectRevert(
      this.lockUpPool.doLockUp(this.hunt.address, 1, 3),
      'MAX_LIMIT_EXCEEDED'
    );
  });

  it('only owner should be able to change emergency mode', async () => {
    assert.equal((await this.lockUpPool.emergencyMode()).valueOf(), false);
    await this.lockUpPool.setEmergencyMode(true, { from: creator });
    assert.equal((await this.lockUpPool.emergencyMode()).valueOf(), true);

    await expectRevert(
      this.lockUpPool.setEmergencyMode(false, { from: alice }),
      'Ownable: caller is not the owner.'
    );
    assert.equal((await this.lockUpPool.emergencyMode()).valueOf(), true);
  });

  it('lock-up function should be paused during emergency mode', async () => {
    await this.lockUpPool.setEmergencyMode(true);
    await expectRevert(
      this.lockUpPool.doLockUp(this.hunt.address, 1000, 3),
      'NOT_ALLOWED_IN_EMERGENCY'
    );
  });

  it('exit function should be paused during emergency mode', async () => {
    await this.hunt.approve(this.lockUpPool.address, 10000);
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 3);
    await this.lockUpPool.setEmergencyMode(true);
    await expectRevert(
      this.lockUpPool.exit(this.hunt.address, 0, true),
      'NOT_ALLOWED_IN_EMERGENCY'
    );
  });

  it('claim function should be paused during emergency mode', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.hunt.transfer(alice, 1000, { from: creator });
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: alice });

    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 3, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 3, { from: alice });
    await this.lockUpPool.exit(this.hunt.address, 0, true, { from: alice });

    await this.lockUpPool.setEmergencyMode(true);
    await expectRevert(
      this.lockUpPool.exit(this.hunt.address, 0, true, { from: creator }),
      'NOT_ALLOWED_IN_EMERGENCY'
    );
  });
});

