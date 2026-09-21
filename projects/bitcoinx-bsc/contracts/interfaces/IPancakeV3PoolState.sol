// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Phan state can doc tu pool PancakeSwap V3 (tuong thich Uniswap V3).
interface IPancakeV3PoolState {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint32 feeProtocol,
            bool unlocked
        );

    function token0() external view returns (address);

    function token1() external view returns (address);
}
