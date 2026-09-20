import { ethers, network } from "hardhat";
import { chainConfig } from "./config";

/**
 * Doi chieu moi hang so trong scripts/config.ts voi du lieu on-chain that.
 * Chay TRUOC MOI LAN DEPLOY. Mot dia chi collateral sai = mat toan bo tien nap vao.
 */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);

  console.log(`\nKiem tra dia chi tren ${cfg.name} (chainId ${chainId}) qua ${network.name}\n`);

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "  OK  " : " FAIL "} ${label.padEnd(26)} ${detail}`);
    if (!ok) failures++;
  };

  const hasCode = async (addr: string) => (await ethers.provider.getCode(addr)) !== "0x";

  // 1. Collateral: phai la hop dong, dung symbol, va <= 18 decimals.
  const erc20 = new ethers.Contract(
    cfg.collateral,
    ["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)"],
    ethers.provider,
  );
  if (await hasCode(cfg.collateral)) {
    const [symbol, decimals, supply] = await Promise.all([erc20.symbol(), erc20.decimals(), erc20.totalSupply()]);
    check("collateral", symbol === cfg.collateralSymbol && Number(decimals) <= 18,
      `${cfg.collateral} symbol=${symbol} decimals=${decimals} supply=${ethers.formatUnits(supply, decimals)}`);
  } else {
    check("collateral", false, `${cfg.collateral} — khong co bytecode`);
  }

  // 2. Chainlink feed: description phai la "BTC / USD".
  const feed = new ethers.Contract(
    cfg.btcUsdFeed,
    ["function description() view returns (string)", "function decimals() view returns (uint8)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
    ethers.provider,
  );
  if (await hasCode(cfg.btcUsdFeed)) {
    const [desc, decimals, round] = await Promise.all([feed.description(), feed.decimals(), feed.latestRoundData()]);
    const price = Number(ethers.formatUnits(round[1], decimals));
    const ageSec = Math.floor(Date.now() / 1000) - Number(round[3]);
    check("btcUsdFeed", desc.replace(/\s/g, "") === "BTC/USD" && price > 0,
      `${cfg.btcUsdFeed} "${desc}" = $${price.toLocaleString()} (cap nhat ${ageSec}s truoc)`);
  } else {
    check("btcUsdFeed", false, `${cfg.btcUsdFeed} — khong co bytecode`);
  }

  // 3. PancakeSwap V3: factory phai biet tick spacing cua poolFee.
  const factory = new ethers.Contract(
    cfg.v3Factory,
    ["function feeAmountTickSpacing(uint24) view returns (int24)"],
    ethers.provider,
  );
  if (await hasCode(cfg.v3Factory)) {
    const spacing = await factory.feeAmountTickSpacing(cfg.poolFee);
    check("v3Factory", spacing > 0n, `${cfg.v3Factory} feeTier=${cfg.poolFee} tickSpacing=${spacing}`);
  } else {
    check("v3Factory", false, `${cfg.v3Factory} — khong co bytecode`);
  }

  // 4. Position manager phai tro ve dung factory tren.
  const npm = new ethers.Contract(cfg.v3PositionManager, ["function factory() view returns (address)"], ethers.provider);
  if (await hasCode(cfg.v3PositionManager)) {
    const f = await npm.factory();
    check("v3PositionManager", f.toLowerCase() === cfg.v3Factory.toLowerCase(),
      `${cfg.v3PositionManager} factory=${f}`);
  } else {
    check("v3PositionManager", false, `${cfg.v3PositionManager} — khong co bytecode`);
  }

  check("v3SwapRouter", await hasCode(cfg.v3SwapRouter), cfg.v3SwapRouter);

  console.log(
    failures === 0
      ? "\nTat ca dia chi hop le. Co the deploy.\n"
      : `\n${failures} muc SAI. DUNG LAI va sua scripts/config.ts truoc khi deploy.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
