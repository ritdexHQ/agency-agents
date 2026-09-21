// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockCpmmPool} from "./MockCpmmPool.sol";

/// @dev SwapRouter gia lap: keo token tu nguoi goi, swap qua pool, kiem tra minOut.
contract MockSwapRouter {
    using SafeERC20 for IERC20;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    MockCpmmPool public immutable pool;

    error TooLittleReceived(uint256 amountOut, uint256 minimum);

    constructor(address pool_) {
        pool = MockCpmmPool(pool_);
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenIn).forceApprove(address(pool), params.amountIn);
        amountOut = pool.swap(params.tokenIn, params.amountIn, params.recipient);
        if (amountOut < params.amountOutMinimum) revert TooLittleReceived(amountOut, params.amountOutMinimum);
    }
}
