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

async function printWarrenEarned(lockUpPool, tokenAddress, accounts) {
  console.log("----------------- WARREN Earned (Pending) -----------------");
  for (let i = 0; i < accounts.length; i++) {
    const pending = (await lockUpPool.pendingWarren(tokenAddress, { from: accounts[i] })).valueOf().toString();
    const effectiveTotalLockUp = (await lockUpPool.myEffectiveLockUpTotal(tokenAddress, { from: accounts[i] })).valueOf().toString();
    console.log(` 🙍🏻‍♂️ Account #${i}: ${pending / 1e18} WARREN (Effective Lock Up: ${effectiveTotalLockUp / 1e18})`);
  }
}

module.exports = {
  printTokenStats,
  printWarrenEarned,
};