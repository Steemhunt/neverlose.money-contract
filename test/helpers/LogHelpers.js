const { time } = require('@openzeppelin/test-helpers');

async function printTokenStats(lockUpPool, tokenAddress) {
  const [
    maxLockUpLimit,
    totalLockUp,
    effectiveTotalLockUp,
    accBonusPerShare,
    totalPenalty,
    accTotalLockUp,
    accLockUpCount,
    activeLockUpCount,
    unlockedCount,
    brokenCount
  ] = Object.values(await lockUpPool.tokenStats(tokenAddress)).map(v => v.valueOf().toString());

  console.log("----------------- Token Stats -----------------\n", {
    maxLockUpLimit,
    totalLockUp,
    effectiveTotalLockUp,
    accBonusPerShare,
    totalPenalty,
    accTotalLockUp,
    accLockUpCount,
    activeLockUpCount,
    unlockedCount,
    brokenCount
  });
}

async function printUserLockUps(lockUpPool, tokenAddress, account) {
  const [
    total,
    effectiveTotal,
    accTotal,
    bonusClaimed,
    bonusDebt,
    lockedUpCount,
    lockUps
  ] = Object.values(await lockUpPool.userLockUps(tokenAddress, account)).map(v => v.valueOf().toString());

  console.log("----------------- User LockUp Stats -----------------\n", {
    total,
    effectiveTotal,
    accTotal,
    bonusClaimed,
    bonusDebt,
    lockedUpCount
  });
}

async function printLockUp(lockUpPool, tokenAddress, account, index) {
  const [
    durationInMonths,
    unlockedAt,
    amount,
    effectiveAmount,
    exitedAt,
  ] = Object.values(await lockUpPool.getLockUp(tokenAddress, account, index)).map(v => v.valueOf().toString());

  console.log("----------------- LockUp -----------------\n", {
    durationInMonths,
    unlockedAt,
    amount,
    effectiveAmount,
    exitedAt,
  });
}

async function printWRNStats(lockUpPool, tokenAddress) {
  const [
    multiplier,
    accWRNPerShare,
    lastRewardBlock,
  ] = Object.values(await lockUpPool.wrnStats(tokenAddress)).map(v => v.valueOf().toString());

  console.log("----------------- WRN Stats -----------------\n", {
    multiplier,
    accWRNPerShare,
    lastRewardBlock,
  });
}

async function printUserWRNReward(lockUpPool, tokenAddress, account) {
  const [
    claimed,
    debt,
  ] = Object.values(await lockUpPool.userWRNRewards(tokenAddress, account)).map(v => v.valueOf().toString());

  console.log("----------------- User WRN Stats -----------------\n", {
    claimed,
    debt,
  });
}

async function printWRNEarned(lockUpPool, tokenAddress, accounts) {
  console.log("----------------- WARREN Earned (Pending) -----------------");
  for (let i = 0; i < accounts.length; i++) {
    const pending = (await lockUpPool.pendingWRN(tokenAddress, { from: accounts[i] })).valueOf().toString();

    const [,effectiveTotalLockUp,,,] = Object.values(await lockUpPool.userLockUps(tokenAddress, account)).map(v => v.valueOf().toString());
    console.log(` 🙍🏻‍♂️ Account #${i}: ${pending / 1e18} WARREN (Effective Lock Up: ${effectiveTotalLockUp / 1e18})`);
  }
}

async function printBlockNumber(point) {
  console.log(`-------------- Point ${point}: ${await time.latestBlock().valueOf()}`);
}

module.exports = {
  printTokenStats,
  printUserLockUps,
  printWRNStats,
  printWRNEarned,
  printUserWRNReward,
  printBlockNumber,
  printLockUp,
};