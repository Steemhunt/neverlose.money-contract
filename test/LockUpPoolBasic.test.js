const ERC20Token = artifacts.require('ERC20Token');
const LockUpPool = artifacts.require('LockUpPool');
const { expectRevert } = require('@openzeppelin/test-helpers');

contract('Basic contract functionality', ([creator]) => {
  beforeEach(async () => {
    this.hunt = await ERC20Token.new({ from: creator });
    this.hunt.initialize('HuntToken', 'HUNT', 10000);

    this.lockUpPool = await LockUpPool.new({ from: creator });
    this.lockUpPool.initialize();

    this.lockUpPool.addLockUpPool(this.hunt.address);
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

  it('exit after lock up period is finished', async () => {
    await this.hunt.approve(this.lockUpPool.address, 1000, { from: creator });
    await this.lockUpPool.doLockUp(this.hunt.address, 1000, 0, { from: creator });
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
});

