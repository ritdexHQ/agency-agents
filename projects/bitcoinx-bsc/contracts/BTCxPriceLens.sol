// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IPancakeV3PoolState} from "./interfaces/IPancakeV3PoolState.sol";
import {BitcoinXVault} from "./BitcoinXVault.sol";

/// @title BTCxPriceLens
/// @notice Hop dong CHI DOC, gom gia BTC/USD (Chainlink), ty gia BTCx/BTCB tren pool
///         PancakeSwap V3, va ty le bao chung cua vault vao mot loi goi.
///
/// @dev QUAN TRONG — dung ky vong sai:
///      Vi khong doc hop dong nay. Vi (OKX, Rabby, Trust, MetaMask...) lay gia tu
///      backend cua chinh ho (CoinGecko / CoinMarketCap / DeBank / index DEX cua ho).
///      Lens nay phuc vu dashboard, bot giu neo, va bang chung du tru cong khai.
///      No KHONG "set" gia cho token — khong hop dong nao lam duoc dieu do.
contract BTCxPriceLens {
    uint256 private constant Q96 = 0x1000000000000000000000000; // 2**96

    IAggregatorV3 public immutable btcUsdFeed;
    IPancakeV3PoolState public immutable pool;
    BitcoinXVault public immutable vault;
    address public immutable btcx;
    address public immutable collateral;
    uint256 public immutable maxStaleness;

    error StalePrice(uint256 updatedAt);
    error InvalidPrice(int256 answer);
    error PoolTokenMismatch();
    error ZeroAddress();

    struct Snapshot {
        uint256 btcUsd1e18; // gia BTC/USD tu Chainlink, chuan hoa 1e18
        uint256 btcxPerBtcb1e18; // BTCB nhan duoc cho 1 BTCx tren pool, 1e18 = neo hoan hao
        uint256 btcxUsd1e18; // gia BTCx quy ra USD theo pool
        uint256 backingRatio1e18; // do bao chung cua vault, 1e18 = 100%
        int256 pegDeviationBps; // lech neo, don vi bps (+ = BTCx dat hon BTC)
        uint256 updatedAt; // thoi diem Chainlink cap nhat lan cuoi
    }

    constructor(address btcUsdFeed_, address pool_, address vault_, uint256 maxStaleness_) {
        if (btcUsdFeed_ == address(0) || pool_ == address(0) || vault_ == address(0)) revert ZeroAddress();

        btcUsdFeed = IAggregatorV3(btcUsdFeed_);
        pool = IPancakeV3PoolState(pool_);
        vault = BitcoinXVault(vault_);
        maxStaleness = maxStaleness_;

        address btcx_ = address(BitcoinXVault(vault_).btcx());
        address collateral_ = address(BitcoinXVault(vault_).collateral());

        address t0 = IPancakeV3PoolState(pool_).token0();
        address t1 = IPancakeV3PoolState(pool_).token1();
        bool ok = (t0 == btcx_ && t1 == collateral_) || (t0 == collateral_ && t1 == btcx_);
        if (!ok) revert PoolTokenMismatch();

        btcx = btcx_;
        collateral = collateral_;
    }

    /// @notice Gia BTC/USD tu Chainlink, chuan hoa ve 1e18, co kiem tra du lieu cu.
    function btcUsd() public view returns (uint256 price1e18, uint256 updatedAt) {
        (, int256 answer,, uint256 updatedAt_,) = btcUsdFeed.latestRoundData();
        if (answer <= 0) revert InvalidPrice(answer);
        if (block.timestamp - updatedAt_ > maxStaleness) revert StalePrice(updatedAt_);

        uint8 feedDecimals = btcUsdFeed.decimals();
        price1e18 = uint256(answer) * (10 ** (18 - feedDecimals));
        updatedAt = updatedAt_;
    }

    /// @notice So BTCB doi duoc cho 1 BTCx theo gia tuc thoi cua pool. 1e18 = neo chuan.
    /// @dev Ca hai token deu 18 decimals nen khong can hieu chinh thap phan.
    function btcxPerBtcb() public view returns (uint256 ratio1e18) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        uint256 sqrtP = uint256(sqrtPriceX96);

        if (pool.token0() == btcx) {
            // price(token1/token0) = (sqrtP / 2^96)^2
            uint256 p = Math.mulDiv(sqrtP, sqrtP, Q96);
            ratio1e18 = Math.mulDiv(p, 1e18, Q96);
        } else {
            // BTCx la token1 -> lay nghich dao
            uint256 inv = Math.mulDiv(Q96, 1e18, sqrtP);
            ratio1e18 = Math.mulDiv(inv, Q96, sqrtP);
        }
    }

    /// @notice Toan bo so lieu can cho dashboard / bot giu neo trong mot lan goi.
    function snapshot() external view returns (Snapshot memory s) {
        (s.btcUsd1e18, s.updatedAt) = btcUsd();
        s.btcxPerBtcb1e18 = btcxPerBtcb();
        s.btcxUsd1e18 = Math.mulDiv(s.btcUsd1e18, s.btcxPerBtcb1e18, 1e18);
        s.backingRatio1e18 = vault.backingRatio();
        s.pegDeviationBps = (int256(s.btcxPerBtcb1e18) - int256(1e18)) * 10_000 / int256(1e18);
    }
}
