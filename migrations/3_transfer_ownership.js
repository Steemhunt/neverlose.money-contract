const { admin } = require('@openzeppelin/truffle-upgrades');
const dotenv = require('dotenv');
dotenv.config();

module.exports = async function (deployer, network, [creator]) {
  if (network !== 'test') {
    // Use address of your Gnosis Safe
    console.log(`Change proxy admin from ${creator} to ${process.env.GNOSIS_SAFE}`);

    // The owner of the ProxyAdmin can upgrade our contracts
    await admin.transferProxyAdminOwnership(process.env.GNOSIS_SAFE);

    // FIXME: Fail with error 'Ownable: caller is not the owner' ?
  }
};
