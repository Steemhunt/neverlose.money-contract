// SPDX-License-Identifier: MIT
import './openzeppelin/math/Math.sol';
import './openzeppelin/presets/ERC20PresetMinterPauser.sol';
import './LockUpPool.sol';

pragma solidity ^0.6.12;

contract WarrenRewardPool is LockUpPool {
    using SafeMath for uint256;
    using SafeERC20 for ERC20PresetMinterPauserUpgradeSafe;

    ERC20PresetMinterPauserUpgradeSafe public WRNToken; // WARREN Reward Token

    // Total of 1M WRN tokens will be distributed for 4 years
    //  - 0.1 WRN per block by default
    //  - 0.5 WRN per block for the beta users (early participants)
    uint256 public constant REWARD_START_BLOCK = block.number; // TODO: Set the future block
    uint256 public constant REWARD_PER_BLOCK = 1e17; // 0.1 WRN
    uint256 public REWARD_END_BLOCK = REWARD_START_BLOCK.add(8000000); // 8M blocks (appx 4 years)

    // 5x distribution for the first 500k blocks (appx 3 months)
    uint256 public constant REWARD_EARLY_BONUS_DURATION = 500000;
    uint256 public constant REWARD_EARLY_BONUS_BOOST = 5;

    uint256 public totalMultiplier;
    struct WRNStats {
      uint256 multiplier; // For WARREN token distribution
      uint256 accWarrenPerShare;
      uint256 lastUpdatedAt;
    }

    struct UserWRNReward {
      uint256 pending; // It should be tracked in addition to `accWarrenPerShare` because halving affects on `warrenPerSecond`
      uint256 claimed; // Only for saving info
      uint256 lastAccWarrenPerShare; // This is used instead of `debt` (accWarrenPerShare * share) due to halving
    }

    // Token => WRNStats
    mapping (address => WRNStats) private _warrenStats;

    // Token => Account => UserWRNReward
    mapping (address => mapping (address => UserWRNReward)) private _userWarrenRewards;

    event PoolAdded(address indexed tokenAddress, uint256 multiplier);
    event WarrenMinted(uint256 currentPoolSize);
    event WarrenClaimed(address indexed account, uint256 amount);

    function initialize(address WRNAddress) public {
      WRNToken = ERC20PresetMinterPauserUpgradeSafe(WRNAddress);

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

    function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) external override _checkPoolExists(tokenAddress) {
      _checkHalve();
      _updateWarrenReward(tokenAddress, msg.sender);

      super.doLockUp(tokenAddress, amount, durationInMonths);
    }

    function exit(address tokenAddress, uint256 lockUpIndex, bool force) external override _checkPoolExists(tokenAddress) {
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

        WRNToken.mint(address(this), currentPoolSize);
        emit WarrenMinted(currentPoolSize);
      } else if (startedAt == 0 || periodFinish == 0) {
        revert('fatal error on initialization');
      }
    }

    function _updateWarrenReward(address tokenAddress, address account) private {
      WRNStats storage warrenStat = _warrenStats[tokenAddress];
      UserWRNReward storage userWarrenReward = _userWarrenRewards[tokenAddress][account];

      warrenStat.accWarrenPerShare = getAccWarrenPerShare(tokenAddress);
      warrenStat.lastUpdatedAt = lastTimeRewardApplicable();

      userWarrenReward.pending = pendingWarren(tokenAddress);
      userWarrenReward.lastAccWarrenPerShare = warrenStat.accWarrenPerShare;
    }

    function getAccWarrenPerShare(address tokenAddress) private view returns (uint256) {
      uint256 totalEffectiveAmount = tokenStats[tokenAddress].effectiveTotalLockUp;
      WRNStats storage warrenStat = _warrenStats[tokenAddress];

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

    function lastTimeRewardApplicable() private view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function pendingWarren(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256) {
      UserWRNReward storage userWarrenReward = _userWarrenRewards[tokenAddress][msg.sender];

      return myEffectiveLockUpTotal(tokenAddress)
        .mul(getAccWarrenPerShare(tokenAddress).sub(userWarrenReward.lastAccWarrenPerShare)) // Only the accumulated value since the last update
        .div(1e18)
        .add(userWarrenReward.pending);
    }

    function claimWarren(address tokenAddress) external _checkPoolExists(tokenAddress) {
      _updateWarrenReward(tokenAddress, msg.sender);

      uint256 amount = pendingWarren(tokenAddress);
      require(amount > 0, 'nothing to claim');

      UserWRNReward storage userWarrenReward = _userWarrenRewards[tokenAddress][msg.sender];

      userWarrenReward.pending = 0;
      userWarrenReward.claimed = userWarrenReward.claimed.add(amount);
      WRNToken.safeTransfer(msg.sender, amount);

      emit WarrenClaimed(msg.sender, amount);
    }

    // TEST:
    function getBlockTimestamp() public view returns (uint256) {
      return block.number;
    }
}