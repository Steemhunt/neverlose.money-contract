// SPDX-License-Identifier: MIT
import "./openzeppelin/math/SafeMath.sol";
import "./openzeppelin/token/ERC20/IERC20.sol";
import "./openzeppelin/token/ERC20/SafeERC20.sol";
import "./openzeppelin/access/Ownable.sol";
import "./openzeppelin/utils/Address.sol";

pragma solidity ^0.7.1;

contract LockUpPool is Initializable, OwnableUpgradeSafe {
  using Address for address;
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // NOTE: didn't use actual constant variable just in case we may chage it on upgrades
  uint256 public PENALTY_RATE;
  uint256 public PLATFORM_FEE_RATE;
  uint256 public SECONDS_IN_MONTH;

  bool public emergencyMode;

  struct LockUp {
    uint256 durationInMonths;
    uint256 unlockedAt; // NOTE: Potential block time manipulation by miners
    uint256 amount;
    uint256 effectiveAmount; // amount * durationBoost
    uint256 exitedAt;
    uint256 penalty;
    uint256 fee;
  }

  struct UserLockUp {
    uint256 total;
    uint256 effectiveTotal;
    uint256 bonusClaimed; // only used for tracking
    uint256 bonusDebt;
    uint256 lockedUpCount; // accumulative lock-up count
    LockUp[] lockUps;
  }

  struct TokenStats {
    uint256 maxLockUpLimit;
    uint256 totalLockUp; // info
    uint256 effectiveTotalLockUp; // sum(amount * durationBoost)
    uint256 totalPenalty; // info
    uint256 totalPlatformFee; // info
    uint256 totalClaimed; // info
    uint256 accBonusPerShare; // Others' Penalty = My Bonus
    uint256 accTotalLockUp; // info
    uint256 accLockUpCount; // info
    uint256 activeLockUpCount; // info
    uint256 unlockedCount; // info
    uint256 brokenCount; // info
  }

  // Token => TokenStats
  mapping (address => TokenStats) public tokenStats;

  // Array of all added tokens
  address[] public pools;

  // Token => Account => UserLockUps
  mapping (address => mapping (address => UserLockUp)) public userLockUps;

  event LockedUp(address indexed token, address indexed account, uint256 amount, uint256 totalLockUp, uint256 durationInMonths, uint256 timestamp);
  event Exited(address indexed token, address indexed account, uint256 amount, uint256 refundAmount, uint256 penalty, uint256 fee, uint256 remainingTotal, uint256 durationInMonths, uint256 timestamp);
  event BonusClaimed(address indexed token, address indexed account, uint256 amount, uint256 timestamp);

  // Fancy math here:
  //   - userLockUp.bonusDebt: Amount that should be deducted (the amount accumulated before I join the pool)
  //   - tokenStat.accBonusPerShare: Accumulated bonus per share of current total pool size
  //     (use accBonusPerShare * 1e18 because the value is normally less than 1 with many decimals)
  //
  // Example
  //   1. bonus: 100 (+100) & pool size: 100 -> 0 (prev value) + 100 / 100 = 1.0
  //   2. bonus: 150 (+50) & pool size: 200 (+100) -> 1 (prev value) + 50 / 200 = 1.25
  //   3. bonus: 250 (+100) & pool size: 230 (+30) -> 1.25 (prev value) + 100 / 230 = 1.68478
  //
  //   bonusEarned = (userLockUp.effectiveTotal * tokenStat.accBonusPerShare) - userLockUp.bonusDebt
  //
  // Whenever a user `exit with a penalty` (when the total pool size gets updated & bonus generated != 0):
  //   => tokenStat.accBonusPerShare + bonus generated (penalty amount) / tokenStat.effectiveTotalLockUp
  //
  // Whenever a user `add a lock-up` (set the amount accumulated before I join the pool):
  //   => userLockUp.bonusDebt = tokenStat.accBonusPerShare * effectiveAmount)

  function initialize() public initializer {
    // manually call the initializers of all parent contracts
    OwnableUpgradeSafe.__Ownable_init();

    PENALTY_RATE = 10;
    PLATFORM_FEE_RATE = 3;
    SECONDS_IN_MONTH = 3600; // For TEST: 1 month = 1 hour
    // SECONDS_IN_MONTH = 2592000;
  }

  modifier _checkPoolExists(address tokenAddress) {
    require(tokenStats[tokenAddress].maxLockUpLimit > 0, 'token pool does not exist');
    _;
  }

  modifier _checkEmergencyMode() {
    require(!emergencyMode, 'not allowed during emergency mode is on');
    _;
  }

  // Should be called on WRNRewardPool#addLockUpRewardPool
  function addLockUpPool(address tokenAddress, uint256 maxLockUpLimit) public onlyOwner {
    require(tokenAddress.isContract(), 'tokeanAddress is not a contract');
    require(tokenStats[tokenAddress].maxLockUpLimit == 0, 'pool already exists');

    pools.push(tokenAddress);
    tokenStats[tokenAddress].maxLockUpLimit = maxLockUpLimit;
  }

  function updateMaxLimit(address tokenAddress, uint256 maxLockUpLimit) external onlyOwner _checkPoolExists(tokenAddress) {
    tokenStats[tokenAddress].maxLockUpLimit = maxLockUpLimit;
  }

  function setEmergencyMode(bool mode) external onlyOwner {
    emergencyMode = mode;
  }

  function _durationBoost(uint256 durationInMonths) private pure returns (uint256) {
    // 3 months = 1x, 6 months = 2x ... 1 year = 4x ... 10 years = 40x
    uint256 durationBoost = durationInMonths.div(3);
    if (durationBoost > 40) {
      durationBoost = 40; // Max 10 years
    }
    return durationBoost;
  }

  function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) public virtual _checkPoolExists(tokenAddress) _checkEmergencyMode {
    require(amount > 0, 'lock up amount must be greater than 0');
    require(durationInMonths >= 3 && durationInMonths <= 120, 'duration must be between 3 and 120 inclusive');

    IERC20 token = IERC20(tokenAddress);

    require(token.balanceOf(msg.sender) >= amount, 'not enough balance');
    require(token.allowance(msg.sender, address(this)) >= amount, 'not enough allowance');

    UserLockUp storage userLockUp = userLockUps[tokenAddress][msg.sender];
    TokenStats storage tokenStat = tokenStats[tokenAddress];

    // Max lock-up amount is restricted during the beta period
    if (tokenStat.maxLockUpLimit < userLockUp.total.add(amount)) {
      revert('max limit exceeded for this pool');
    }

    // Should claim bonus before exit, otherwise `earnedBonus` will become zero afterwards
    claimBonus(tokenAddress);

    token.safeTransferFrom(msg.sender, address(this), amount);

    // Add LockUp
    uint256 effectiveAmount = amount.mul(_durationBoost(durationInMonths));
    userLockUp.lockUps.push(
      LockUp(
        durationInMonths,
        block.timestamp.add(durationInMonths.mul(SECONDS_IN_MONTH)), // unlockedAt
        amount,
        effectiveAmount,
        0, // exitedAt
        0, // penalty
        0 // fee
      )
    );

    // Update user lockUp stats
    userLockUp.total = userLockUp.total.add(amount);
    userLockUp.effectiveTotal = userLockUp.effectiveTotal.add(effectiveAmount);
    userLockUp.lockedUpCount = userLockUp.lockedUpCount.add(1);

    // Update TokenStats
    tokenStat.totalLockUp = tokenStat.totalLockUp.add(amount);
    tokenStat.accTotalLockUp = tokenStat.accTotalLockUp.add(amount);
    tokenStat.accLockUpCount = tokenStat.accLockUpCount.add(1);
    tokenStat.activeLockUpCount = tokenStat.activeLockUpCount.add(1);
    tokenStat.effectiveTotalLockUp = tokenStat.effectiveTotalLockUp.add(effectiveAmount);

    _updateBonusDebt(tokenAddress, msg.sender);

    emit LockedUp(tokenAddress, msg.sender, amount, tokenStat.totalLockUp, durationInMonths, block.timestamp);
  }

  // Update user's bonus debt as current accumulated bonus value (accBonusPerShare * effectiveTotal)
  function _updateBonusDebt(address tokenAddress, address account) private {
    userLockUps[tokenAddress][account].bonusDebt = tokenStats[tokenAddress].accBonusPerShare
      .mul(userLockUps[tokenAddress][account].effectiveTotal).div(1e18);
  }

  function exit(address tokenAddress, uint256 lockUpId, bool force) public virtual _checkPoolExists(tokenAddress) _checkEmergencyMode {
    UserLockUp storage userLockUp = userLockUps[tokenAddress][msg.sender];
    LockUp storage lockUp = userLockUp.lockUps[lockUpId];

    require(lockUp.exitedAt == 0, 'already exited');
    require(force || block.timestamp >= lockUp.unlockedAt, 'has not unlocked yet');

    // Should claim bonus before exit, otherwise `earnedBonus` will become zero afterwards
    claimBonus(tokenAddress);

    uint256 penalty = 0;
    uint256 fee = 0;

    // Penalty on force exit
    if (force && block.timestamp < lockUp.unlockedAt) {
      penalty = lockUp.amount.mul(PENALTY_RATE).div(100);
      fee = lockUp.amount.mul(PLATFORM_FEE_RATE).div(100);
      // revert(string(abi.encodePacked(penalty, '+', fee)));
    } else if (force) {
      revert('force not necessary');
    }

    uint256 refundAmount = lockUp.amount.sub(penalty).sub(fee);

    // Update lockUp
    lockUp.exitedAt = block.timestamp;
    lockUp.penalty = penalty;
    lockUp.fee = fee;

    // Update token stats
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    tokenStat.totalLockUp = tokenStat.totalLockUp.sub(lockUp.amount);
    tokenStat.effectiveTotalLockUp = tokenStat.effectiveTotalLockUp.sub(lockUp.effectiveAmount);
    tokenStat.totalPenalty = tokenStat.totalPenalty.add(penalty);
    tokenStat.totalPlatformFee = tokenStat.totalPlatformFee.add(fee);

    tokenStat.activeLockUpCount = tokenStat.activeLockUpCount.sub(1);
    if (penalty > 0) {
      tokenStat.brokenCount = tokenStat.brokenCount.add(1);
    } else {
      tokenStat.unlockedCount = tokenStat.unlockedCount.add(1);
    }

    // Update user lockUp stats
    userLockUp.total = userLockUp.total.sub(lockUp.amount);
    userLockUp.effectiveTotal = userLockUp.effectiveTotal.sub(lockUp.effectiveAmount);
    _updateBonusDebt(tokenAddress, msg.sender);

    // Update tokenStat.accBonusPerShare when reward pool gets updated (when penalty added)
    //   * If the last person exit with a penalty, we don't update `accBonusPerShare`,
    //     so the penalty amount will be locked up on the contract permanently
    //     because the next person's reward debt is the left over amount
    if (penalty > 0 && tokenStat.effectiveTotalLockUp > 0) {
      tokenStat.accBonusPerShare = tokenStat.accBonusPerShare.add(penalty.mul(1e18).div(tokenStat.effectiveTotalLockUp));
    }

    IERC20 token = IERC20(tokenAddress);
    token.safeTransfer(msg.sender, refundAmount);
    token.safeTransfer(owner(), fee); // Platform fee

    emit Exited(tokenAddress, msg.sender, lockUp.amount, refundAmount, penalty, fee, userLockUp.total, lockUp.durationInMonths, block.timestamp);
  }

  function earnedBonus(address tokenAddress) public view returns (uint256) {
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    UserLockUp storage userLockUp = userLockUps[tokenAddress][msg.sender];

    // NOTE: it doesn't subtract `userLockUp.bonusClaimed` as it's already included in `userLockUp.bonusDebt`

    return userLockUp.effectiveTotal
      .mul(tokenStat.accBonusPerShare).div(1e18)
      .sub(userLockUp.bonusDebt); // The accumulated amount before I join the pool
  }

  function claimBonus(address tokenAddress) public _checkPoolExists(tokenAddress) _checkEmergencyMode {
    uint256 amount = earnedBonus(tokenAddress);

    if (amount == 0) {
      return;
    }

    TokenStats storage tokenStat = tokenStats[tokenAddress];
    UserLockUp storage userLockUp = userLockUps[tokenAddress][msg.sender];

    // Update user lockUp stats
    userLockUp.bonusClaimed = userLockUp.bonusClaimed.add(amount);
    _updateBonusDebt(tokenAddress, msg.sender);

    // Update token stats
    tokenStat.totalClaimed = tokenStat.totalClaimed.add(amount);

    IERC20(tokenAddress).safeTransfer(msg.sender, amount);

    emit BonusClaimed(tokenAddress, msg.sender, amount, block.timestamp);
  }

  // MARK: - Utility view functions

  function totalClaimableBonus(address tokenAddress) external view returns (uint256) {
    return tokenStats[tokenAddress].totalPenalty.sub(tokenStats[tokenAddress].totalClaimed);
  }

  function poolCount() external view returns(uint256) {
    return pools.length;
  }

  function getLockUp(address tokenAddress, address account, uint256 lockUpId) external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256) {
    LockUp storage lockUp = userLockUps[tokenAddress][account].lockUps[lockUpId];

    return (
      lockUp.durationInMonths,
      lockUp.unlockedAt,
      lockUp.amount,
      lockUp.effectiveAmount,
      lockUp.exitedAt,
      lockUp.penalty,
      lockUp.fee
    );
  }

  function lockedUpAt(address tokenAddress, address account, uint256 lockUpId) external view returns (uint256) {
    LockUp storage lockUp = userLockUps[tokenAddress][account].lockUps[lockUpId];

    return lockUp.unlockedAt.sub(lockUp.durationInMonths.mul(SECONDS_IN_MONTH));
  }

  // Reserved storage space to allow for layout changes in the future.
  uint256[50] private ______gap;
}
