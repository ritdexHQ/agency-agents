// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockCpmmPool} from "./MockCpmmPool.sol";

/// @dev QuoterV2 gia lap. Chu y: ham KHONG khai bao `view`, dung nhu QuoterV2
///      that — day la ly do phia client phai goi bang staticCall.
contract MockQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    address public immutable factory;
    MockCpmmPool public immutable pool;
    /// @dev Ton tai de ham duoi day thuc su khong phai `view`, giong QuoterV2 that.
    uint256 public quoteCount;

    constructor(address factory_, address pool_) {
        factory = factory_;
        pool = MockCpmmPool(pool_);
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
    {
        quoteCount++;
        (amountOut, sqrtPriceX96After) = pool.quote(params.tokenIn, params.amountIn);
        initializedTicksCrossed = 1;
        gasEstimate = 120_000;
    }
}
