const { admin } = require('@openzeppelin/truffle-upgrades');
const dotenv = require('dotenv');
dotenv.config();

module.exports = async function (deployer, network, [creator]) {
  if (network === 'mainnet') {
    // Use address of your Gnosis Safe
    console.log(`Change proxy admin from ${creator} to ${process.env.GNOSIS_SAFE}`);

    // The owner of the ProxyAdmin can upgrade our contracts
    await admin.transferProxyAdminOwnership(process.env.GNOSIS_SAFE);

    // FIXME: Fail with error 'Ownable: caller is not the owner' ?
    // Seems ProxyAdmin does not reset with --reset option
    // Probably we need to delete .openzeppelin/mainnet.json file to reset admin info
  }
};

// const WRNRewardPool = artifacts.require('WRNRewardPool');
// const WRNRewardPoolV2 = artifacts.require('WRNRewardPoolV2');
// const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
// module.exports = async function (deployer) {
//   const pool = await WRNRewardPool.deployed();
//   await prepareUpgrade(pool.address, WRNRewardPoolV2, { deployer, unsafeAllowCustomTypes: true });
// };