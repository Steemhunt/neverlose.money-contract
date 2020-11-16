const Migrations = artifacts.require("Migrations");

module.exports = function (deployer, network, [creator]) {
  console.log(`Deploying from owner: ${creator}`);

  deployer.deploy(Migrations);
};
