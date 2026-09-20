// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BitcoinXVault} from "../BitcoinXVault.sol";

/// @dev Collateral doc hai: moi lan vault chuyen tien ra thi goi nguoc lai redeem().
///      Dung de chung minh `nonReentrant` chan duoc tan cong tai nhap.
contract ReentrantCollateral is ERC20 {
    BitcoinXVault public vault;
    bool public attack;

    constructor() ERC20("Evil BTCB", "eBTCB") {}

    function setVault(address vault_) external {
        vault = BitcoinXVault(vault_);
    }

    function setAttack(bool attack_) external {
        attack = attack_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (attack && address(vault) != address(0) && from == address(vault)) {
            vault.redeem(1, address(this));
        }
    }
}
