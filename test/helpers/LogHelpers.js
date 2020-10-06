const { time } = require('@openzeppelin/test-helpers');

async function printTokenStats(lockUpPool, tokenAddress) {
  const [
    poolExists,
    totalLockUp,
    effectiveTotalLockUp,
    totalPenalty,
    totalPlatformFee,
    totalClaimed,
    accBonusPerShare,
  ] = Object.values(await lockUpPool.tokenStats(tokenAddress)).map(v => v.valueOf().toString());

  console.log("----------------- Token Stats -----------------\n", {
    poolExists,
    totalLockUp,
    effectiveTotalLockUp,
    totalPenalty,
    totalPlatformFee,
    totalClaimed,
    accBonusPerShare,
  });
}

async function printWRNStats(lockUpPool, tokenAddress) {
  const [
    multiplier,
    accWRNPerShare,
    lastRewardBlock,
  ] = Object.values(await lockUpPool.wrnStats(tokenAddress)).map(v => v.valueOf().toString());

  console.log("----------------- Token Stats -----------------\n", {
    multiplier,
    accWRNPerShare,
    lastRewardBlock,
  });
}

async function printWRNEarned(lockUpPool, tokenAddress, accounts) {
  console.log("----------------- WARREN Earned (Pending) -----------------");
  for (let i = 0; i < accounts.length; i++) {
    const pending = (await lockUpPool.pendingWRN(tokenAddress, { from: accounts[i] })).valueOf().toString();
    const effectiveTotalLockUp = (await lockUpPool.myEffectiveLockUpTotal(tokenAddress, { from: accounts[i] })).valueOf().toString();
    console.log(` 🙍🏻‍♂️ Account #${i}: ${pending / 1e18} WARREN (Effective Lock Up: ${effectiveTotalLockUp / 1e18})`);
  }
}

async function printBlockNumber(point) {
  console.log(`-------------- Point ${point}: ${await time.latestBlock().valueOf()}`);
}

module.exports = {
  printTokenStats,
  printWRNStats,
  printWRNEarned,
  printBlockNumber,
};