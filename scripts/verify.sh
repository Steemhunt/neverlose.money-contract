# Step 1: Proxy contract
# AdminUpgradeabilityProxy should be verified manually using a flatten verion of source code:
# (FlattenedAdminUpgradeabilityProxy.sol)
# REF: https://forum.openzeppelin.com/t/verify-upgrades-plugins-proxy-on-etherscan/3920
# REF: https://forum.openzeppelin.com/t/generate-flattened-version-of-adminupgradeabilityproxy-sol

# Step 2: Implementation contract
truffle run verify WRNRewardPool@0x65C0DfBB89a35e3e514e0B02eca34aC2E3BBf7EF --network mainnet
truffle run verify ERC20Token@0xDD1680c6D1190DF4e8AE5eD0D15803600e5f486A --network mainnet

# -> Lock-up Contract: 0x7edBE5aF30Ba6Ba2DE9EdDc72C2f585D1B0D5775
# -> WRN: 0x6a76Fe028056717703F357d1D073B439e4D24b0E

# Step 3: Connect
# Connect the proxy contract to the implementation contract on Etherscan interface:
# (Contract -> More Options -> Is this a proxy?)