// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "./openzeppelin/presets/ERC20PresetMinterPauser.sol";
import "./openzeppelin/Initializable.sol";

contract ERC20Token is Initializable, ERC20PresetMinterPauserUpgradeSafe {
  function initialize(string memory name, string memory symbol, uint256 initialSupply) public initializer {
    ERC20PresetMinterPauserUpgradeSafe.initialize(name, symbol);
    _mint(msg.sender, initialSupply);
  }
}