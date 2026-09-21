// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {BitcoinX} from "./BitcoinX.sol";

/// @title BitcoinXVault
/// @notice Kho bao chung 1:1 cho BTCx. Nap BTCB -> nhan BTCx. Tra BTCx -> rut BTCB.
///
/// @dev DAY LA TOAN BO CO CHE "NEO GIA THEO BITCOIN".
///      Khong co oracle nao dat gia BTCx. Gia BTCx bang gia BTC vi bat ky ai cung
///      co the doi 1 BTCx lay 1 BTCB tai day, khong xin phep, khong gioi han:
///      - Neu gia tren DEX < 1 BTCB: arbitrageur mua re tren DEX, redeem o vault -> gia bi day len.
///      - Neu gia tren DEX > 1 BTCB: arbitrageur mint o vault, ban tren DEX -> gia bi keo xuong.
///      Vi vay `redeem()` KHONG BAO GIO pause duoc. Chu so huu chi co the tam dung `mint()`
///      (vi du khi phat hien su co o token collateral) va KHONG BAO GIO chan duong rut.
///
///      Bat bien he thong: collateralBalance * SCALE >= btcx.totalSupply()
///      duoc kiem tra lai sau moi lan mint/redeem.
contract BitcoinXVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Tran phi cung trong bytecode: khong ai, ke ca owner, dat phi qua 0.50%.
    uint16 public constant MAX_FEE_BPS = 50;

    /// @notice BTCx — chi vault nay mint/burn duoc.
    BitcoinX public immutable btcx;
    /// @notice Tai san bao chung (BTCB tren BSC mainnet).
    IERC20 public immutable collateral;
    /// @notice He so quy doi decimals collateral -> 18 decimals cua BTCx.
    uint256 public immutable scale;

    uint16 public mintFeeBps;
    uint16 public redeemFeeBps;
    address public feeRecipient;
    /// @notice Chi chan duong MINT. Duong REDEEM khong the bi chan.
    bool public mintPaused;

    event Minted(address indexed caller, address indexed to, uint256 collateralIn, uint256 btcxOut, uint256 fee);
    event Redeemed(address indexed caller, address indexed to, uint256 btcxIn, uint256 collateralOut, uint256 fee);
    event FeesUpdated(uint16 mintFeeBps, uint16 redeemFeeBps);
    event FeeRecipientUpdated(address indexed feeRecipient);
    event MintPausedSet(bool paused);
    event Swept(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error MintIsPaused();
    error FeeTooHigh();
    error UnsupportedCollateralDecimals();
    error CollateralNotSweepable();
    error Insolvent();

    constructor(address collateral_, address feeRecipient_, address owner_) Ownable(owner_) {
        if (collateral_ == address(0) || feeRecipient_ == address(0) || owner_ == address(0)) revert ZeroAddress();

        uint8 collateralDecimals = IERC20Metadata(collateral_).decimals();
        if (collateralDecimals > 18) revert UnsupportedCollateralDecimals();

        collateral = IERC20(collateral_);
        scale = 10 ** (18 - collateralDecimals);
        feeRecipient = feeRecipient_;

        // Token duoc tao ngay tai day nen `BitcoinX.vault` la immutable va bang dia chi
        // vault nay. Khong ton tai giai doan nao ma quyen mint nam o tay nguoi khac.
        btcx = new BitcoinX(address(this));

        emit FeeRecipientUpdated(feeRecipient_);
    }

    // --------------------------------------------------------------------
    // Mint / Redeem
    // --------------------------------------------------------------------

    /// @notice Nap `collateralAmount` BTCB, nhan BTCx (tru phi mint neu co).
    /// @param collateralAmount So BTCB nap vao (18 decimals tren BSC).
    /// @param to Dia chi nhan BTCx.
    /// @return btcxOut So BTCx thuc nhan.
    function mint(uint256 collateralAmount, address to) external nonReentrant returns (uint256 btcxOut) {
        if (mintPaused) revert MintIsPaused();
        if (to == address(0)) revert ZeroAddress();
        if (collateralAmount == 0) revert ZeroAmount();

        // Do theo chenh lech so du thay vi tin vao tham so: an toan ca voi token
        // co thue chuyen khoan. BTCB khong co thue, nhung vault nay tai su dung duoc.
        uint256 balanceBefore = collateral.balanceOf(address(this));
        collateral.safeTransferFrom(msg.sender, address(this), collateralAmount);
        uint256 received = collateral.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        uint256 fee = (received * mintFeeBps) / BPS_DENOMINATOR;
        uint256 net = received - fee;

        btcxOut = net * scale;
        if (btcxOut == 0) revert ZeroAmount();

        if (fee > 0) collateral.safeTransfer(feeRecipient, fee);
        btcx.mint(to, btcxOut);

        _assertSolvent();
        emit Minted(msg.sender, to, received, btcxOut, fee);
    }

    /// @notice Tra BTCx, rut BTCB. KHONG BAO GIO bi pause — day la neo gia cua he thong.
    /// @param btcxAmount So BTCx muon doi.
    /// @param to Dia chi nhan BTCB.
    /// @return collateralOut So BTCB thuc nhan (tru phi redeem neu co).
    function redeem(uint256 btcxAmount, address to) external nonReentrant returns (uint256 collateralOut) {
        if (to == address(0)) revert ZeroAddress();
        if (btcxAmount == 0) revert ZeroAmount();

        // Lam tron xuong ve don vi collateral, va CHI burn dung phan quy doi duoc.
        // Phan du (chi ton tai neu collateral < 18 decimals) o lai vi nguoi dung,
        // khong bi nuot.
        uint256 gross = btcxAmount / scale;
        if (gross == 0) revert ZeroAmount();
        uint256 burnAmount = gross * scale;

        uint256 fee = (gross * redeemFeeBps) / BPS_DENOMINATOR;
        collateralOut = gross - fee;

        btcx.burn(msg.sender, burnAmount);
        if (fee > 0) collateral.safeTransfer(feeRecipient, fee);
        collateral.safeTransfer(to, collateralOut);

        _assertSolvent();
        emit Redeemed(msg.sender, to, burnAmount, collateralOut, fee);
    }

    // --------------------------------------------------------------------
    // Views — dung cho dashboard / proof-of-reserve
    // --------------------------------------------------------------------

    function collateralBalance() public view returns (uint256) {
        return collateral.balanceOf(address(this));
    }

    /// @notice Ty le bao chung, 1e18 = 100%. Luon >= 1e18 neu he thong lanh manh.
    function backingRatio() external view returns (uint256) {
        uint256 supply = btcx.totalSupply();
        if (supply == 0) return type(uint256).max;
        return (collateralBalance() * scale * 1e18) / supply;
    }

    function previewMint(uint256 collateralAmount) external view returns (uint256 btcxOut, uint256 fee) {
        fee = (collateralAmount * mintFeeBps) / BPS_DENOMINATOR;
        btcxOut = (collateralAmount - fee) * scale;
    }

    function previewRedeem(uint256 btcxAmount) external view returns (uint256 collateralOut, uint256 fee) {
        uint256 gross = btcxAmount / scale;
        fee = (gross * redeemFeeBps) / BPS_DENOMINATOR;
        collateralOut = gross - fee;
    }

    // --------------------------------------------------------------------
    // Quan tri — pham vi cuc hep va co tran cung
    // --------------------------------------------------------------------

    function setFees(uint16 mintFeeBps_, uint16 redeemFeeBps_) external onlyOwner {
        if (mintFeeBps_ > MAX_FEE_BPS || redeemFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        mintFeeBps = mintFeeBps_;
        redeemFeeBps = redeemFeeBps_;
        emit FeesUpdated(mintFeeBps_, redeemFeeBps_);
    }

    function setFeeRecipient(address feeRecipient_) external onlyOwner {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    /// @notice Tam dung phat hanh moi. Khong anh huong den `redeem()`.
    function setMintPaused(bool paused_) external onlyOwner {
        mintPaused = paused_;
        emit MintPausedSet(paused_);
    }

    /// @notice Thu hoi token gui nham vao vault. KHONG the dong toi collateral —
    ///         phan bao chung nam ngoai tam voi cua owner theo dung bytecode.
    function sweep(address token, address to) external onlyOwner {
        if (token == address(collateral)) revert CollateralNotSweepable();
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit Swept(token, to, amount);
    }

    function _assertSolvent() internal view {
        if (collateralBalance() * scale < btcx.totalSupply()) revert Insolvent();
    }
}
