// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Pool V3 gia lap: chi can slot0 + token0/token1.
contract MockV3Pool {
    address public token0;
    address public token1;
    uint160 public sqrtPriceX96;

    constructor(address token0_, address token1_, uint160 sqrtPriceX96_) {
        token0 = token0_;
        token1 = token1_;
        sqrtPriceX96 = sqrtPriceX96_;
    }

    function setSqrtPriceX96(uint160 sqrtPriceX96_) external {
        sqrtPriceX96 = sqrtPriceX96_;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint32, bool) {
        return (sqrtPriceX96, 0, 0, 1, 1, 0, true);
    }
}
