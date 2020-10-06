// SPDX-License-Identifier: MIT
import './openzeppelin/math/Math.sol';
import './openzeppelin/presets/ERC20PresetMinterPauser.sol';
import './LockUpPool.sol';

pragma solidity ^0.6.12;

contract WRNRewardPool is LockUpPool {
    using SafeMath for uint256;
    using SafeERC20 for ERC20PresetMinterPauserUpgradeSafe;

    ERC20PresetMinterPauserUpgradeSafe public WRNToken; // WRN Reward Token

    uint256 public REWARD_START_BLOCK;
    uint256 public REWARD_PER_BLOCK;
    uint256 public REWARD_END_BLOCK;
    uint256 public REWARD_EARLY_BONUS_END_BLOCK;
    uint256 public REWARD_EARLY_BONUS_BOOST;

    uint256 public totalMultiplier;
    struct WRNStats {
      uint256 multiplier; // For WRN token distribution
      uint256 accWRNPerShare;
      uint256 lastRewardBlock;
    }

    struct UserWRNReward {
      uint256 claimed; // Only for saving info
      uint256 debt; // This is used instead of `debt` (accWRNPerShare * share) due to halving
    }

    // Token => WRNStats
    mapping (address => WRNStats) private _wrnStats;

    // Token => Account => UserWRNReward
    mapping (address => mapping (address => UserWRNReward)) private _userWRNRewards;

    event PoolAdded(address indexed tokenAddress, uint256 multiplier);
    event WRNMinted(uint256 amount);
    event WRNClaimed(address indexed account, uint256 amount);

    function initialize(address WRNAddress) public {
      OwnableUpgradeSafe.__Ownable_init();

      WRNToken = ERC20PresetMinterPauserUpgradeSafe(WRNAddress);

      // Total of 1M WRN tokens will be distributed for 4 years
      //  - 0.1 WRN per block by default
      //  - 0.5 WRN per block for the beta users (early participants)
      REWARD_START_BLOCK = block.number; // TODO: Set the future block
      REWARD_PER_BLOCK = 1e17; // 0.1 WRN
      REWARD_END_BLOCK = REWARD_START_BLOCK.add(8000000); // 8M blocks (appx 4 years)

      // 5x distribution for the first 500k blocks (appx 3 months)
      REWARD_EARLY_BONUS_END_BLOCK = REWARD_START_BLOCK.add(500000);
      REWARD_EARLY_BONUS_BOOST = 5;
    }

    // MARK: - Overiiding LockUpPool

    function addLockUpRewardPool(address tokenAddress, uint256 multiplier) public {
      require(multiplier >= 1, 'multiplier must be greater than or equal to 1');

      addLockUpPool(tokenAddress);

      _wrnStats[tokenAddress].multiplier = multiplier;
      totalMultiplier = totalMultiplier.add(multiplier);

      emit PoolAdded(tokenAddress, multiplier);
    }

    // TODO:
    // function setPoolMultiplier(address tokenAddress, uint256 multiplier) public {
    // }

    function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) public override _checkPoolExists(tokenAddress) {
      _updatePool(tokenAddress);

      // shouldn't get the bonus that's already accumulated before the user joined
      _userWRNRewards[tokenAddress][msg.sender].debt = _wrnStats[tokenAddress].accWRNPerShare
        .mul(myEffectiveLockUpTotal(tokenAddress)).div(1e18);

      super.doLockUp(tokenAddress, amount, durationInMonths);
    }

    function exit(address tokenAddress, uint256 lockUpIndex, bool force) public override _checkPoolExists(tokenAddress) {
      _updatePool(tokenAddress);

      super.exit(tokenAddress, lockUpIndex, force);
    }

    // Return WRN per block over the given from to to block.
    function getWRNPerBlock(uint256 from, uint256 to) private view returns (uint256) {
      if (from > REWARD_END_BLOCK) { // Reward pool finished
        return 0;
      } else if (to >= REWARD_END_BLOCK) { // Partial finished
        return REWARD_END_BLOCK.sub(from).mul(REWARD_PER_BLOCK);
      } else if (to <= REWARD_EARLY_BONUS_END_BLOCK) { // Bonus period
        return to.sub(from).mul(REWARD_EARLY_BONUS_BOOST).mul(REWARD_PER_BLOCK);
      } else if (from >= REWARD_EARLY_BONUS_END_BLOCK) { // Bonus finished
        return to.sub(from).mul(REWARD_PER_BLOCK);
      } else { // Partial bonus period
        return REWARD_EARLY_BONUS_END_BLOCK.sub(from).mul(REWARD_EARLY_BONUS_BOOST).mul(REWARD_PER_BLOCK).add(
          to.sub(REWARD_EARLY_BONUS_END_BLOCK).mul(REWARD_PER_BLOCK)
        );
      }
    }

    function _updatePool(address tokenAddress) private {
      WRNStats storage wrnStat = _wrnStats[tokenAddress];
      if (block.number <= wrnStat.lastRewardBlock) {
        return;
      }

      uint256 wrnToMint = getWRNPerBlock(wrnStat.lastRewardBlock, block.number)
        .mul(wrnStat.multiplier)
        .div(totalMultiplier);

      TokenStats storage tokenStat = tokenStats[tokenAddress];
      if (tokenStat.effectiveTotalLockUp > 0 && wrnToMint > 0) {
        // WRNToken.mint(devaddr, wrnToMint.div(10)); // Dev pool?
        WRNToken.mint(address(this), wrnToMint);
        wrnStat.accWRNPerShare = wrnStat.accWRNPerShare.add(wrnToMint.mul(1e18).div(tokenStat.effectiveTotalLockUp));

        emit WRNMinted(wrnToMint);
      }

      wrnStat.lastRewardBlock = block.number;
    }

    function pendingWRN(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256) {
      WRNStats storage wrnStat = _wrnStats[tokenAddress];
      UserWRNReward storage userWRNReward = _userWRNRewards[tokenAddress][msg.sender];
      uint256 myShare = myEffectiveLockUpTotal(tokenAddress);

      return myShare.mul(wrnStat.accWRNPerShare)
        .mul(wrnStat.multiplier)
        .div(totalMultiplier)
        .div(1e18)
        .sub(userWRNReward.debt)
        .sub(userWRNReward.claimed);
    }

    function claimWRN(address tokenAddress) external _checkPoolExists(tokenAddress) {
      _updatePool(tokenAddress);

      uint256 amount = pendingWRN(tokenAddress);
      require(amount > 0, 'nothing to claim');

      UserWRNReward storage userWRNReward = _userWRNRewards[tokenAddress][msg.sender];

      userWRNReward.claimed = userWRNReward.claimed.add(amount);
      WRNToken.safeTransfer(msg.sender, amount);

      emit WRNClaimed(msg.sender, amount);
    }
}