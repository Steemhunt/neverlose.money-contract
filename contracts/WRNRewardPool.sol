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
    uint256 claimed;
    uint256 debt;
  }

  // Token => WRNStats
  mapping (address => WRNStats) public wrnStats;

  // Token => Account => UserWRNReward
  mapping (address => mapping (address => UserWRNReward)) public userWRNRewards;

  // Dev address for WRN disrtribution
  address public devAddress;

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
    REWARD_END_BLOCK = REWARD_START_BLOCK.add(8800000); // 8.8M blocks (appx 4 years and 3 months)

    // 5x distribution for the first 500k blocks (appx 3 months)
    REWARD_EARLY_BONUS_END_BLOCK = REWARD_START_BLOCK.add(500000);
    REWARD_EARLY_BONUS_BOOST = 5;
  }

  // MARK: - Overiiding LockUpPool

  function addLockUpRewardPool(address tokenAddress, uint256 multiplier) public {
    require(multiplier >= 1, 'multiplier must be greater than or equal to 1');

    addLockUpPool(tokenAddress);

    wrnStats[tokenAddress].multiplier = multiplier;
    totalMultiplier = totalMultiplier.add(multiplier);

    emit PoolAdded(tokenAddress, multiplier);
  }

  // TODO:
  // function setPoolMultiplier(address tokenAddress, uint256 multiplier) public {
  // }

  function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) public override _checkPoolExists(tokenAddress) {
    _updatePool(tokenAddress);

    super.doLockUp(tokenAddress, amount, durationInMonths);

    // shouldn't get the bonus that's already accumulated before the user joined
    userWRNRewards[tokenAddress][msg.sender].debt = wrnStats[tokenAddress].accWRNPerShare
      .mul(myEffectiveLockUpTotal(tokenAddress)).div(1e18);
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
    WRNStats storage wrnStat = wrnStats[tokenAddress];
    if (block.number <= wrnStat.lastRewardBlock) {
      return;
    }

    TokenStats storage tokenStat = tokenStats[tokenAddress];
    uint256 wrnToMint = _getAccWRNTillNow(tokenAddress);

    if (tokenStat.effectiveTotalLockUp > 0 && wrnToMint > 0) {
      WRNToken.mint(devAddress, wrnToMint.div(9)); // 10% dev pool (120,000 / (1,080,000 + 120,000) = 10%)
      WRNToken.mint(address(this), wrnToMint);
      wrnStat.accWRNPerShare = wrnStat.accWRNPerShare.add(wrnToMint.mul(1e18).div(tokenStat.effectiveTotalLockUp));

      emit WRNMinted(wrnToMint);
    }

    wrnStat.lastRewardBlock = block.number;
  }

  function _getAccWRNTillNow(address tokenAddress) private view returns (uint256) {
    WRNStats storage wrnStat = wrnStats[tokenAddress];

    return getWRNPerBlock(wrnStat.lastRewardBlock, block.number)
      .mul(wrnStat.multiplier)
      .div(totalMultiplier);
  }

  function pendingWRN(address tokenAddress) public view _checkPoolExists(tokenAddress) returns (uint256) {
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    WRNStats storage wrnStat = wrnStats[tokenAddress];
    UserWRNReward storage userWRNReward = userWRNRewards[tokenAddress][msg.sender];

    uint256 accWRNPerShare = wrnStat.accWRNPerShare;
    if (block.number > wrnStat.lastRewardBlock && tokenStat.effectiveTotalLockUp != 0) {
      uint256 accWRNTillNow = _getAccWRNTillNow(tokenAddress);
      accWRNPerShare = accWRNPerShare.add(accWRNTillNow.mul(1e18).div(tokenStat.effectiveTotalLockUp));
    }

    uint256 myShare = myEffectiveLockUpTotal(tokenAddress);
    return myShare.mul(accWRNPerShare)
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

    UserWRNReward storage userWRNReward = userWRNRewards[tokenAddress][msg.sender];

    userWRNReward.claimed = userWRNReward.claimed.add(amount);
    WRNToken.safeTransfer(msg.sender, amount);

    emit WRNClaimed(msg.sender, amount);
  }

  function dev(address _devAddress) public onlyOwner {
    devAddress = _devAddress;
  }
}
