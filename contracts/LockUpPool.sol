// SPDX-License-Identifier: MIT
import "./openzeppelin/math/SafeMath.sol";
import "./openzeppelin/token/ERC20/IERC20.sol";
import "./openzeppelin/token/ERC20/SafeERC20.sol";
import "./openzeppelin/access/Ownable.sol";
import "./openzeppelin/utils/Address.sol";

pragma solidity ^0.6.12;

contract LockUpPool is Initializable, OwnableUpgradeSafe {
  using Address for address;
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 private constant PENALTY_RATE = 10;
  uint256 private constant PLATFORM_FEE_RATE = 3;

  // TODO:
  // - Add brokenAt
  struct LockUp {
    uint256 durationInMonths;
    uint256 unlockedTimestamp;
    uint256 amount;
    uint256 effectiveAmount; // amount * durationBoost
  }

  struct UserLockUp {
    uint256 total;
    uint256 effectiveTotal;
    uint256 bonusClaimed;
    uint256 bonusDebt;
    LockUp[] lockUps;
  }

  struct TokenStats {
    bool poolExists;
    uint256 totalLockUp;
    uint256 effectiveTotalLockUp; // sum(amount * durationBoost)
    uint256 totalPenalty;
    uint256 totalPlatformFee;
    uint256 totalClaimed;
    uint256 accBonusPerShare; // Others' Penalty = My Bonus
  }

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
  //   bonusEarned = (userLockUp.effectiveTotal * tokenStat.accBonusPerShare) - userLockUp.bonusDebt - userLockUp.bonusClaimed
  //
  // Whenever a user `exit with a penalty` (when the total pool size gets updated & bonus generated != 0):
  //   => tokenStat.accBonusPerShare + bonus generated (penalty amount) / tokenStat.effectiveTotalLockUp
  //
  // Whenever a user `add a lock-up` (set the amount accumulated before I join the pool):
  //   => userLockUp.bonusDebt = tokenStat.accBonusPerShare * effectiveAmount)

  // Token => Account => UserLockUps
  mapping (address => mapping (address => UserLockUp)) private _userLockUps;

  // Token => TokenStats
  mapping (address => TokenStats) public tokenStats;

  event LockedUp(address indexed token, address indexed account, uint256 amount, uint256 totalLockUp);
  event Exited(address indexed token, address indexed account, uint256 amount, uint256 penalty, uint256 fee, uint256 totalLockUp);
  event BonusClaimed(address indexed token, address indexed account, uint256 amount);

  function initialize() public initializer {
    OwnableUpgradeSafe.__Ownable_init();
  }

  // Should be called on WarrenRewardPool#addLockUpRewardPool
  function addLockUpPool(address tokenAddress) public onlyOwner {
    require(tokenAddress.isContract(), 'tokeanAddress is not a contract');
    require(!tokenStats[tokenAddress].poolExists, 'pool already exists');

    tokenStats[tokenAddress].poolExists = true;
  }

  function addressToString(address _addr) public pure returns(string memory) {
    bytes32 value = bytes32(uint256(_addr));
    bytes memory alphabet = "0123456789abcdef";

    bytes memory str = new bytes(51);
    str[0] = "0";
    str[1] = "x";
    for (uint i = 0; i < 20; i++) {
        str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
        str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
    }
    return string(str);
}

  // TODO: Test gas consumptuion without this validation
  modifier _checkPoolExists(address tokenAddress) {
    require(tokenStats[tokenAddress].poolExists, 'token pool does not exist');
    // require(tokenStats[tokenAddress].poolExists, string(abi.encodePacked('token pool does not exist: ', addressToString(tokenAddress), ' - ', addressToString(msg.sender))));
    _;
  }

  function _durationBoost(uint256 durationInMonths) private pure returns (uint256) {
    // 3 months = 1x, 6 months = 2x ... 1 year = 4x ... 10 years = 40x
    uint256 durationBoost = durationInMonths.div(3);
    if (durationBoost > 40) {
      durationBoost = 40; // Max 10 years
    }
    return durationBoost;
  }

  function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) external virtual _checkPoolExists(tokenAddress) {
    require(amount > 0, 'lock up amount must be greater than 0');
    // require(durationInMonths >= 3, 'duration must be greater than or equal to 3'); // TEST
    require(durationInMonths <= 120, 'duration must be less than or equal to 120');

    IERC20 token = IERC20(tokenAddress);

    require(token.balanceOf(msg.sender) >= amount, 'not enough balance');
    require(token.allowance(msg.sender, address(this)) >= amount, 'not enough allowance');

    token.safeTransferFrom(msg.sender, address(this), amount);

    // Add LockUp
    uint256 effectiveAmount = amount.mul(_durationBoost(durationInMonths));
    UserLockUp storage userLockUp = _userLockUps[tokenAddress][msg.sender];
    userLockUp.lockUps.push(
      LockUp(
        durationInMonths,
        block.timestamp.add(durationInMonths.mul(2592000)), // unlockedTimestamp
        amount,
        effectiveAmount
      )
    );

    // Update user lockUp stats
    userLockUp.total = userLockUp.total.add(amount);
    userLockUp.effectiveTotal = userLockUp.effectiveTotal.add(effectiveAmount);

    // Update TokenStats
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    tokenStat.totalLockUp = tokenStat.totalLockUp.add(amount);
    tokenStat.effectiveTotalLockUp = tokenStat.effectiveTotalLockUp.add(effectiveAmount);

    // shouldn't get the bonus that's already accumulated before the user joined
    userLockUp.bonusDebt = tokenStat.accBonusPerShare.mul(effectiveAmount).div(1e18);

    emit LockedUp(tokenAddress, msg.sender, amount, tokenStat.totalLockUp);
  }

  // TODO: Refactoring
  function myLockUp(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256, uint256) {
    return (_userLockUps[tokenAddress][msg.sender].total, _userLockUps[tokenAddress][msg.sender].effectiveTotal);
  }

  function myEffectiveLockUpTotal(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256) {
    return _userLockUps[tokenAddress][msg.sender].effectiveTotal;
  }

  function lockedUpTimestamp(address tokenAddress, address account, uint256 lockUpId) public view returns (uint256) {
    LockUp storage lockUp = _userLockUps[tokenAddress][msg.sender].lockUps[lockUpId];

    return lockUp.unlockedTimestamp.sub(lockUp.durationInMonths.mul(2592000));
  }

  function exit(address tokenAddress, uint256 lockUpId, bool force) external virtual _checkPoolExists(tokenAddress) {
    UserLockUp storage userLockUp = _userLockUps[tokenAddress][msg.sender];
    LockUp storage lockUp = userLockUp.lockUps[lockUpId];

    require(force || block.timestamp >= lockUp.unlockedTimestamp, 'has not unlocked yet');

    uint256 penalty = 0;
    uint256 fee = 0;

    // Penalty
    if (force && block.timestamp < lockUp.unlockedTimestamp) {
      penalty = lockUp.amount.mul(PENALTY_RATE).div(100);
      fee = lockUp.amount.mul(PLATFORM_FEE_RATE).div(100);
    }

    uint256 refundAmount = lockUp.amount - penalty - fee;

    // Update user lockUp stats
    userLockUp.total = userLockUp.total.sub(lockUp.amount);
    userLockUp.effectiveTotal = userLockUp.effectiveTotal.sub(lockUp.effectiveAmount);

    // Update token stats
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    tokenStat.totalLockUp = tokenStat.totalLockUp.sub(lockUp.amount);
    tokenStat.effectiveTotalLockUp = tokenStat.effectiveTotalLockUp.sub(lockUp.effectiveAmount);
    tokenStat.totalPenalty = tokenStat.totalPenalty.add(penalty);
    tokenStat.totalPlatformFee = tokenStat.totalPlatformFee.add(fee);

    // Update tokenStat.accBonusPerShare when reward pool gets updaterd
    //   * If the last person exit with a penalty, we don't update `accBonusPerShare`,
    //     so the penalty amount will be locked up on the contract permanently
    //     because the next person's reward debt is the left over amount
    if (penalty > 0 && tokenStat.effectiveTotalLockUp > 0) {
      tokenStat.accBonusPerShare = tokenStat.accBonusPerShare.add(penalty.mul(1e18).div(tokenStat.effectiveTotalLockUp));
    }

    IERC20 token = IERC20(tokenAddress);
    token.safeTransfer(msg.sender, refundAmount);
    token.safeTransfer(owner(), fee); // Platform fee
  }

  function earnedBonus(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256) {
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    UserLockUp storage userLockUp = _userLockUps[tokenAddress][msg.sender];

    return userLockUp.effectiveTotal
      .mul(tokenStat.accBonusPerShare).div(1e18)
      .sub(userLockUp.bonusDebt) // The accumulated amount before I join the pool
      .sub(userLockUp.bonusClaimed); // The accumulated amount I already claimed
  }

  function totalClaimableBonus(address tokenAddress) external view _checkPoolExists(tokenAddress) returns (uint256) {
    return tokenStats[tokenAddress].totalPenalty.sub(tokenStats[tokenAddress].totalClaimed);
  }

  function claimBonus(address tokenAddress) external _checkPoolExists(tokenAddress) {
    uint256 amount = earnedBonus(tokenAddress);

    TokenStats storage tokenStat = tokenStats[tokenAddress];
    UserLockUp storage userLockUp = _userLockUps[tokenAddress][msg.sender];

    // Update user lockUp stats
    userLockUp.bonusClaimed = userLockUp.bonusClaimed.add(amount);

    // Update token stats
    tokenStat.totalClaimed = tokenStat.totalClaimed.add(amount);

    IERC20(tokenAddress).safeTransfer(msg.sender, amount);

    emit BonusClaimed(tokenAddress, msg.sender, amount);
  }
}
