// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title BitcoinX (BTCx)
/// @notice ERC20 tren BNB Smart Chain, duoc bao chung 1:1 boi BTCB (Binance-Peg Bitcoin).
///
/// @dev Thiet ke toi gian co chu dich:
///      - KHONG owner, KHONG blacklist, KHONG pause transfer, KHONG thue mua/ban.
///      - KHONG ai mint duoc, ke ca deployer. Chi `vault` mint/burn, va `vault`
///        chi mint khi da nhan du collateral tuong ung.
///      - `vault` la `immutable`: ghi trong constructor, khong bao gio doi duoc.
///        Dia chi vault duoc tinh truoc tu nonce cua deployer (xem scripts/01_deploy.ts),
///        nen khong ton tai "cua so tin cay" nao sau khi deploy.
///      Ket qua: totalSupply luon == luong BTCB dang khoa trong vault. Do la co so
///      duy nhat khien gia BTCx bam theo gia BTC — khong phai mot bien so trong code.
contract BitcoinX is ERC20, ERC20Permit {
    /// @notice Hop dong duy nhat duoc phep mint/burn BTCx.
    address public immutable vault;

    error OnlyVault();
    error ZeroAddress();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(address vault_) ERC20("BitcoinX", "BTCx") ERC20Permit("BitcoinX") {
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
    }

    /// @notice So le thap phan, khop voi BTCB tren BSC (18) de ty le mint/redeem la 1:1 chan.
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @notice Mint BTCx. Chi vault goi duoc, va chi sau khi vault da nhan collateral.
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /// @notice Burn BTCx khi nguoi dung rut collateral.
    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}
