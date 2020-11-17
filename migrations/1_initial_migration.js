const Migrations = artifacts.require("Migrations");

module.exports = async function (deployer, network, [creator]) {
  if (network === 'test') return;

  console.log(`Deploying from owner: ${creator}`);

  deployer.deploy(Migrations);
};
