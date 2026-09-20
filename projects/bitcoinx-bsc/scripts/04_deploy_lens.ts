import { ethers, network } from "hardhat";
import { chainConfig, PRICE_MAX_STALENESS } from "./config";
import { loadDeployment, updateDeployment } from "./io";

/** Deploy BTCxPriceLens — hop dong chi doc gom gia + do lech neo + do bao chung. */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);

  if (!d.pool) throw new Error("Chua co pool. Chay scripts/03_seed_liquidity.ts truoc.");

  console.log(`\nDeploy BTCxPriceLens tren ${cfg.name} (${network.name})`);
  console.log(`  feed  ${cfg.btcUsdFeed}`);
  console.log(`  pool  ${d.pool}`);
  console.log(`  vault ${d.vault}\n`);

  const lens = await (await ethers.getContractFactory("BTCxPriceLens")).deploy(
    cfg.btcUsdFeed,
    d.pool,
    d.vault,
    PRICE_MAX_STALENESS,
  );
  await lens.waitForDeployment();
  const address = await lens.getAddress();

  const s = await lens.snapshot();
  console.log(`Lens            : ${cfg.explorer}/address/${address}`);
  console.log(`BTC/USD         : $${Number(ethers.formatUnits(s.btcUsd1e18, 18)).toLocaleString()}`);
  console.log(`BTCx/BTCB       : ${ethers.formatUnits(s.btcxPerBtcb1e18, 18)}`);
  console.log(`BTCx/USD        : $${Number(ethers.formatUnits(s.btcxUsd1e18, 18)).toLocaleString()}`);
  console.log(`Do bao chung    : ${(Number(s.backingRatio1e18) / 1e16).toFixed(2)}%`);
  console.log(`Lech neo        : ${s.pegDeviationBps} bps\n`);

  updateDeployment(chainId, { lens: address });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
