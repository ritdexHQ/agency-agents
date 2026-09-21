// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev Pool gia lap dung cho smoke test bot giu neo.
///
///      Khong phai ban sao PancakeSwap V3 — no dung tich so khong doi. Nhung no
///      co dung nhung gi bot doc (`slot0`, `token0`, `liquidity`) va co hanh vi
///      tac dong gia don dieu, du de kiem chung viec chon quy mo lenh va huong
///      arbitrage. Thanh khoan tap trung chi lam do sau khac di, khong doi dau
///      cua tin hieu.
contract MockCpmmPool {
    using SafeERC20 for IERC20;

    uint256 private constant Q192 = 1 << 192;

    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee; // bps * 100, giong V3 (100 = 0,01%)

    // Chi tang khi co swap — nap thanh khoan thi khong. Day la cach
    // scripts/09_bootstrap_trade.ts biet pool da tung duoc giao dich hay chua.
    uint256 public feeGrowthGlobal0X128;
    uint256 public feeGrowthGlobal1X128;

    error UnknownToken();

    constructor(address tokenA, address tokenB, uint24 fee_) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        fee = fee_;
    }

    function reserve0() public view returns (uint256) {
        return IERC20(token0).balanceOf(address(this));
    }

    function reserve1() public view returns (uint256) {
        return IERC20(token1).balanceOf(address(this));
    }

    /// @notice sqrtPriceX96 suy ra tu du tru hien tai.
    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint32, bool) {
        return (uint160(_sqrtPriceX96(reserve0(), reserve1())), int24(0), uint16(0), uint16(1), uint16(1), uint32(0), true);
    }

    function liquidity() external view returns (uint128) {
        return uint128(Math.sqrt(reserve0() * reserve1()));
    }

    /// @notice Mo phong swap ma khong doi trang thai — dung cho quoter.
    function quote(address tokenIn, uint256 amountIn)
        public
        view
        returns (uint256 amountOut, uint160 sqrtPriceX96After)
    {
        if (tokenIn != token0 && tokenIn != token1) revert UnknownToken();
        bool zeroForOne = tokenIn == token0;
        (uint256 rIn, uint256 rOut) = zeroForOne ? (reserve0(), reserve1()) : (reserve1(), reserve0());

        uint256 amountInAfterFee = amountIn - (amountIn * fee) / 1_000_000;
        amountOut = (rOut * amountInAfterFee) / (rIn + amountInAfterFee);

        uint256 newIn = rIn + amountIn;
        uint256 newOut = rOut - amountOut;
        (uint256 n0, uint256 n1) = zeroForOne ? (newIn, newOut) : (newOut, newIn);
        sqrtPriceX96After = uint160(_sqrtPriceX96(n0, n1));
    }

    function swap(address tokenIn, uint256 amountIn, address to) external returns (uint256 amountOut) {
        (amountOut,) = quote(tokenIn, amountIn);
        address tokenOut = tokenIn == token0 ? token1 : token0;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);

        uint256 feeAmount = (amountIn * fee) / 1_000_000 + 1;
        if (tokenIn == token0) feeGrowthGlobal0X128 += feeAmount;
        else feeGrowthGlobal1X128 += feeAmount;
    }

    function _sqrtPriceX96(uint256 r0, uint256 r1) private pure returns (uint256) {
        if (r0 == 0 || r1 == 0) return 0;
        return Math.sqrt(Math.mulDiv(r1, Q192, r0));
    }
}
