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
  event WRNMinted(address indexed tokenAddress, uint256 amount);
  event WRNClaimed(address indexed tokenAddress, address indexed account, uint256 amount);

  function initialize(address WRNAddress) public initializer {
    LockUpPool.initialize();

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

    devAddress = msg.sender;
  }

  // MARK: - Overiiding LockUpPool

  function addLockUpRewardPool(address tokenAddress, uint256 multiplier, bool shouldUpdate) public onlyOwner {
    require(multiplier >= 1, 'multiplier must be greater than or equal to 1');

    if(shouldUpdate) {
      // NOTE: This could fail with out-of-gas if too many tokens are added.
      // Adding a new pool without updating other existing pools may result in
      // less pending & claimable value of exiting pools' WRN reward.
      // So if this fails due to out-of-gas issue, the owner MUST update all pools manually
      updateAllPools();
    }

    addLockUpPool(tokenAddress);

    wrnStats[tokenAddress].multiplier = multiplier;
    totalMultiplier = totalMultiplier.add(multiplier);

    emit PoolAdded(tokenAddress, multiplier);
  }

  // TODO:
  // function setPoolMultiplier(address tokenAddress, uint256 multiplier) public {
  // }

  function doLockUp(address tokenAddress, uint256 amount, uint256 durationInMonths) public override {
    updatePool(tokenAddress);

    super.doLockUp(tokenAddress, amount, durationInMonths);

    // shouldn't get the bonus that's already accumulated before the user joined
    _updateDebt(tokenAddress, msg.sender);
  }

  function _updateDebt(address tokenAddress, address account) private {
    userWRNRewards[tokenAddress][account].debt = wrnStats[tokenAddress].accWRNPerShare
      .mul(userLockUps[tokenAddress][account].effectiveTotal).div(1e18);
  }

  function exit(address tokenAddress, uint256 lockUpIndex, bool force) public override {
    // Should claim WRN before exit, otherwise `pendingWRN` will become zero afterwards
    claimWRN(tokenAddress);

    super.exit(tokenAddress, lockUpIndex, force);

    _updateDebt(tokenAddress, msg.sender);
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

  // Update all pools
  // NOTE: This could fail with out-of-gas if too many tokens are added
  function updateAllPools() public {
    uint256 length = pools.length;
    for (uint256 pid = 0; pid < length; ++pid) {
      updatePool(pools[pid]);
    }
  }

  function updatePool(address tokenAddress) public _checkPoolExists(tokenAddress) {
    WRNStats storage wrnStat = wrnStats[tokenAddress];
    if (block.number <= wrnStat.lastRewardBlock) {
      return;
    }

    TokenStats storage tokenStat = tokenStats[tokenAddress];
    uint256 wrnToMint = _getAccWRNTillNow(tokenAddress);

    if (wrnStat.lastRewardBlock != 0 && tokenStat.effectiveTotalLockUp > 0 && wrnToMint > 0) {
      WRNToken.mint(devAddress, wrnToMint.div(9)); // 10% dev pool (120,000 / (1,080,000 + 120,000) = 10%)
      WRNToken.mint(address(this), wrnToMint);
      wrnStat.accWRNPerShare = wrnStat.accWRNPerShare.add(
        wrnToMint.mul(1e18).div(tokenStat.effectiveTotalLockUp)
      );

      emit WRNMinted(tokenAddress, wrnToMint);
    }

    wrnStat.lastRewardBlock = block.number;
  }

  function _getAccWRNTillNow(address tokenAddress) private view returns (uint256) {
    WRNStats storage wrnStat = wrnStats[tokenAddress];

    return getWRNPerBlock(wrnStat.lastRewardBlock, block.number)
      .mul(wrnStat.multiplier)
      .div(totalMultiplier);
  }

  function pendingWRN(address tokenAddress) public view returns (uint256) {
    TokenStats storage tokenStat = tokenStats[tokenAddress];
    WRNStats storage wrnStat = wrnStats[tokenAddress];
    UserWRNReward storage userWRNReward = userWRNRewards[tokenAddress][msg.sender];

    uint256 accWRNPerShare = wrnStat.accWRNPerShare;
    if (block.number > wrnStat.lastRewardBlock && tokenStat.effectiveTotalLockUp != 0) {
      uint256 accWRNTillNow = _getAccWRNTillNow(tokenAddress);
      accWRNPerShare = accWRNPerShare.add(
        accWRNTillNow.mul(1e18).div(tokenStat.effectiveTotalLockUp)
      );
    }

    // NOTE: it doesn't subtract `userWRNReward.claimed` as it's already included in `userWRNReward.debt`
    return userLockUps[tokenAddress][msg.sender].effectiveTotal
      .mul(accWRNPerShare)
      .div(1e18)
      .sub(userWRNReward.debt);
  }

  function claimWRN(address tokenAddress) public {
    updatePool(tokenAddress);

    uint256 amount = pendingWRN(tokenAddress);
    require(amount > 0, 'nothing to claim');

    UserWRNReward storage userWRNReward = userWRNRewards[tokenAddress][msg.sender];

    userWRNReward.claimed = userWRNReward.claimed.add(amount);
    _updateDebt(tokenAddress, msg.sender);

    WRNToken.safeTransfer(msg.sender, amount);

    emit WRNClaimed(tokenAddress, msg.sender, amount);
  }

  function dev(address _devAddress) public onlyOwner {
    devAddress = _devAddress;
  }
}
