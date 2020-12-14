# Step 1: Proxy contract
# AdminUpgradeabilityProxy should be verified manually using a flatten verion of source code:
# (FlattenedAdminUpgradeabilityProxy.sol)
# REF: https://forum.openzeppelin.com/t/verify-upgrades-plugins-proxy-on-etherscan/3920
# REF: https://forum.openzeppelin.com/t/generate-flattened-version-of-adminupgradeabilityproxy-sol

# Step 2: Implementation contract
truffle run verify WRNRewardPool@0x6de0118Cf0f5F2539f88B4771c17595151E47c39 --network mainnet
truffle run verify ERC20Token@0xf78239eEC1A4a0475f668705D7b404C0c0305C60 --network mainnet

# -> Lock-up Contract: 0x5DbfB3B13cA896E623b502aA7DaEc6e86dEe2Ee6
# -> WRN: 0x2673a7a49A209642C637F6dC6b80F6938EB38B18

# Step 3: Connect
# Connect the proxy contract to the implementation contract on Etherscan interface:
# (Contract -> More Options -> Is this a proxy?)