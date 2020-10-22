const ERC20Token = artifacts.require('ERC20Token');
const LockUpPool = artifacts.require('LockUpPool');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { toBN } = require('./helpers/NumberHelpers');

contract('Basic contract functionality', ([creator, alice]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    await this.hunt.initialize('HuntToken', 'HUNT', 10000);

    this.lockUpPool = await LockUpPool.new({ from: creator });
    await this.lockUpPool.initialize();

    await this.lockUpPool.addLockUpPool(this.hunt.address, toBN(9999999999999));
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
    this.wbtc.initialize('Wrapped BTC', 'wBTC', 10000);

    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await expectRevert(this.lockUpPool.doLockUp(this.wbtc.address, 1000, 9, { from: creator }), 'token pool does not exist');
  });

  it('should fail on lack of balance or allowance', async () => {
    await expectRevert(this.lockUpPool.doLockUp(this.hunt.address, 10001, 9, { from: creator }), 'not enough balance');
    await expectRevert(this.lockUpPool.doLockUp(this.hunt.address, 1000, 9, { from: creator }), 'not enough allowance');
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
      'duration must be between 3 and 120 inclusive'
    );

    await expectRevert(
      this.lockUpPool.doLockUp(this.hunt.address, 1000, 2, { from: creator }),
      'duration must be between 3 and 120 inclusive'
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

    await time.increase(86400 * 30 * 4);

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

  it('should not cut any fee on matured lockup', async () => {
    await this.hunt.approve(this.lockUpPool.address, 10000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 10000, 3, { from: creator });
    await time.increase(86400 * 30 * 4);
    await this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator });

    // LockUp pool test again
    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), 10000);
  });

  it('should handle double-exits properly', async () => {
    await this.hunt.approve(this.lockUpPool.address, 10000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 10000, 3, { from: creator });
    await time.increase(86400 * 30 * 4);
    await this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator });

    await expectRevert(
      this.lockUpPool.exit(this.hunt.address, 0, false, { from: creator }),
      'already exited'
    );

    assert.equal((await this.hunt.balanceOf(creator, { from: creator })).valueOf(), 10000);
  });

  it('owner should be able to add a pool', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 10000);
    await this.lockUpPool.addLockUpPool(this.wbtc.address, toBN(123));

    const [maxLockUpLimit, totalLockUp] = Object.values(await this.lockUpPool.tokenStats(this.wbtc.address, { from: creator }));

    assert.equal(maxLockUpLimit / 1e18, 123);
    assert.equal(totalLockUp, 0);
  });

  it('non-owner should not be able to add a pool', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 10000);

    await expectRevert(
      this.lockUpPool.addLockUpPool(this.wbtc.address, toBN(123), { from: alice}),
      'Ownable: caller is not the owner.'
    );
  });

  it('owner should be able to update max limit', async () => {
    await this.lockUpPool.updateMaxLimit(this.hunt.address, toBN(456));
    const [maxLockUpLimit] = Object.values(await this.lockUpPool.tokenStats(this.hunt.address, { from: creator }));
    assert.equal(maxLockUpLimit / 1e18, 456);
  });

  it('non-owner should not be able to update max limit', async () => {
    this.wbtc = await ERC20Token.new({ from: creator });
    await this.wbtc.initialize('Wrapped BTC', 'wBTC', 10000);

    await expectRevert(
      this.lockUpPool.updateMaxLimit(this.hunt.address, toBN(456), { from: alice }),
      'Ownable: caller is not the owner.'
    );
  });

  it('should not allow lock-up more than the max limit', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000);

    await this.lockUpPool.updateMaxLimit(this.hunt.address, 100);
    await this.lockUpPool.doLockUp(this.hunt.address, 100, 3);
    const [amount] = Object.values(await this.lockUpPool.userLockUps(this.hunt.address, creator));
    assert.equal(amount, 100);

    await expectRevert(
      this.lockUpPool.doLockUp(this.hunt.address, 1, 3),
      'max limit exceeded for this pool'
    );
  });
});

