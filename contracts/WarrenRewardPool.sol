// SPDX-License-Identifier: MIT
import './openzeppelin/math/Math.sol';
import './openzeppelin/presets/ERC20PresetMinterPauser.sol';
import './LockUpPool.sol';

pragma solidity ^0.6.12;

contract WarrenRewardPool is LockUpPool {
    using SafeMath for uint256;
    using SafeERC20 for ERC20PresetMinterPauserUpgradeSafe;

    ERC20PresetMinterPauserUpgradeSafe public rewardToken; // WARREN

    uint256 public DURATION;
    uint256 public currentPoolSize;
    uint256 public startAt;
    uint256 public startedAt;
    uint256 public warrenPerSecond;
    uint256 public periodFinish;

    uint256 public totalMultiplier;
    struct WarrenStats {
      uint256 multiplier; // For WARREN token distribution
      uint256 accWarrenPerShare;
      uint256 lastUpdatedAt;
    }

    struct UserWarrenReward {
      uint256 pending; // It should be tracked in addition to `accWarrenPerShare` because halving affects on `warrenPerSecond`
      uint256 claimed; // Only for saving info
      uint256 lastAccWarrenPerShare; // This is used instead of `debt` (accWarrenPerShare * share) due to halving
    }

    // Token => WarrenStats
    mapping (address => WarrenStats) private _warrenStats;

    // Token => Account => UserWarrenReward
    mapping (address => mapping (address => UserWarrenReward)) private _userWarrenRewards;

    event PoolAdded(address indexed tokenAddress, uint256 multiplier);
    event HalvingCompleted(uint256 currentPoolSize, uint256 timestamp);
    event WarrenMinted(uint256 currentPoolSize);
    event WarrenClaimed(address indexed account, uint256 amount);

    function initialize(address rewardTokenAddress) public {
      rewardToken = ERC20PresetMinterPauserUpgradeSafe(rewardTokenAddress);
      DURATION = 7 days;
      currentPoolSize = 7000e18;
      startAt = block.timestamp; // TODO: Set time in the future

      OwnableUpgradeSafe.__Ownable_init();
    }

    // MARK: - Overiiding LockUpPool

    function addLockUpRewardPool(address tokenAddress, uint256 multiplier) public {
      require(multiplier >= 1, 'multiplier must be greater than or equal to 1');

      addLockUpPool(tokenAddress);

      _warrenStats[tokenAddress].multiplier = multiplier;
      _warrenStats[tokenAddress].lastUpdatedAt = block.timestamp > startAt ? block.timestamp : startAt;
      totalMultiplier = totalMultiplier.add(multiplier);

      emit PoolAdded(tokenAddress, multiplier);
    }

    // TODO:
    // function setPoolMultiplier(address tokenAddress, uint256 multiplier) public {

    // }

    function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) public override _checkPoolExists(tokenAddress) {
      _checkHalve();
      _updateWarrenReward(tokenAddress, msg.sender);

      super.doLockUp(tokenAddress, amount, durationInMonths);
    }

    function exit(address tokenAddress, uint256 lockUpIndex, bool force) public override _checkPoolExists(tokenAddress) {
      _checkHalve();
      _updateWarrenReward(tokenAddress, msg.sender);

      super.exit(tokenAddress, lockUpIndex, force);
    }

    function _checkHalve() private {
      require(block.timestamp >= startAt, 'not started yet');

      if (block.timestamp >= periodFinish) { // First or halving
        if (startedAt == 0) { // On first start
          startedAt = block.timestamp;
          periodFinish = startedAt.add(DURATION);
        } else { // On halving
          currentPoolSize = currentPoolSize.div(2);
          periodFinish = periodFinish.add(DURATION);

          emit HalvingCompleted(currentPoolSize, block.timestamp);
        }

        // This updates will affect on `accWarrenPerShare`, so the latest `earned` value should be saved
        warrenPerSecond = currentPoolSize.div(DURATION);

        rewardToken.mint(address(this), currentPoolSize);
        emit WarrenMinted(currentPoolSize);
      } else if (startedAt == 0 || periodFinish == 0) {
        revert('fatal error on initialization');
      }
    }

    function _updateWarrenReward(address tokenAddress, address account) private {
      WarrenStats storage warrenStat = _warrenStats[tokenAddress];
      UserWarrenReward storage userWarrenReward = _userWarrenRewards[tokenAddress][account];

      warrenStat.accWarrenPerShare = getAccWarrenPerShare(tokenAddress);
      warrenStat.lastUpdatedAt = lastTimeRewardApplicable();

      userWarrenReward.pending = pendingWarren(tokenAddress);
      userWarrenReward.lastAccWarrenPerShare = warrenStat.accWarrenPerShare;
    }

    function getAccWarrenPerShare(address tokenAddress) private view returns (uint256) {
      uint256 totalEffectiveAmount = tokenStats[tokenAddress].effectiveTotalLockUp;
      WarrenStats storage warrenStat = _warrenStats[tokenAddress];

      // Give nothing when the pool is empty
      if(totalEffectiveAmount == 0) {
        return _warrenStats[tokenAddress].accWarrenPerShare;
      }

      return warrenStat.accWarrenPerShare.add(
        lastTimeRewardApplicable()
          .sub(warrenStat.lastUpdatedAt) // The last time anyone lockup / exit
          .mul(warrenPerSecond)
          .mul(1e18)
          .mul(warrenStat.multiplier)
          .div(totalEffectiveAmount)
      );
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function pendingWarren(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256) {
      UserWarrenReward storage userWarrenReward = _userWarrenRewards[tokenAddress][msg.sender];

      return myEffectiveLockUpTotal(tokenAddress)
        .mul(getAccWarrenPerShare(tokenAddress).sub(userWarrenReward.lastAccWarrenPerShare)) // Only the accumulated value since the last update
        .div(1e18)
        .add(userWarrenReward.pending);
    }

    function claimWarren(address tokenAddress) public _checkPoolExists(tokenAddress) {
      _updateWarrenReward(tokenAddress, msg.sender);

      uint256 amount = pendingWarren(tokenAddress);
      require(amount > 0, 'nothing to claim');

      UserWarrenReward storage userWarrenReward = _userWarrenRewards[tokenAddress][msg.sender];

      userWarrenReward.pending = 0;
      userWarrenReward.claimed = userWarrenReward.claimed.add(amount);
      rewardToken.safeTransfer(msg.sender, amount);

      emit WarrenClaimed(msg.sender, amount);
    }

    // TEST:
    function getBlockTimestamp() public view returns (uint256) {
      return block.number;
    }
}