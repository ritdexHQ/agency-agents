import { ethers, network } from "hardhat";
import { chainConfig } from "./config";
import { loadDeployment } from "./io";

const Q96 = 2n ** 96n;
const ONE = 10n ** 18n;
const POOL_ABI = [
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
  "function token0() view returns (address)",
];

/**
 * Giam sat neo gia. Chay dinh ky (cron 5 phut) trong 72 gio dau va moi ngay sau do.
 *
 * Doc ky: script nay KHONG tu dong giao dich. No bao dung mot dieu — gia tren pool
 * dang lech bao nhieu so voi 1 BTCB, va huong arbitrage nao co loi. Viec dat lenh
 * la quyet dinh cua con nguoi.
 */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);
  if (!d.pool) throw new Error("Chua co pool. Chay scripts/03_seed_liquidity.ts truoc.");

  const alertBps = Number(process.env.PEG_ALERT_BPS || 50);

  const vault = await ethers.getContractAt("BitcoinXVault", d.vault);
  const btcx = await ethers.getContractAt("BitcoinX", d.btcx);
  const collateral = new ethers.Contract(
    d.collateral,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider,
  );
  const pool = new ethers.Contract(d.pool, POOL_ABI, ethers.provider);
  const feed = new ethers.Contract(
    cfg.btcUsdFeed,
    ["function decimals() view returns (uint8)", "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
    ethers.provider,
  );

  const [slot0, token0, supply, locked, feedDecimals, round] = await Promise.all([
    pool.slot0(),
    pool.token0(),
    btcx.totalSupply(),
    collateral.balanceOf(d.vault),
    feed.decimals(),
    feed.latestRoundData(),
  ]);

  // Ty gia BTCB nhan duoc cho 1 BTCx, theo gia tuc thoi cua pool.
  const sqrtP = BigInt(slot0[0]);
  const priceToken1PerToken0 = (sqrtP * sqrtP * ONE) / (Q96 * Q96);
  const btcxIsToken0 = token0.toLowerCase() === d.btcx.toLowerCase();
  const btcxPerBtcb = btcxIsToken0 ? priceToken1PerToken0 : (ONE * ONE) / priceToken1PerToken0;

  const devBps = Number(((btcxPerBtcb - ONE) * 10_000n) / ONE);
  const btcUsd = Number(ethers.formatUnits(round[1], feedDecimals));
  const btcxUsd = (btcUsd * Number(btcxPerBtcb)) / 1e18;
  const backingPct = supply === 0n ? 100 : (Number(locked) / Number(supply)) * 100;
  const feedAgeSec = Math.floor(Date.now() / 1000) - Number(round[3]);

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`\n[${stamp}] BitcoinX / ${cfg.name}`);
  console.log(`  BTC/USD (Chainlink) : $${btcUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}  (${feedAgeSec}s truoc)`);
  console.log(`  BTCx/BTCB (pool)    : ${ethers.formatUnits(btcxPerBtcb, 18).slice(0, 12)}`);
  console.log(`  BTCx/USD (suy ra)   : $${btcxUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  console.log(`  Lech neo            : ${devBps > 0 ? "+" : ""}${devBps} bps`);
  console.log(`  Luu hanh / khoa     : ${ethers.formatUnits(supply, 18)} BTCx / ${ethers.formatUnits(locked, 18)} ${"BTCB"}`);
  console.log(`  Do bao chung        : ${backingPct.toFixed(4)}%`);
  console.log(`  Mint dang           : ${(await vault.mintPaused()) ? "TAM DUNG" : "mo"}`);

  // --- Canh bao ---
  const alerts: string[] = [];
  if (supply > locked) alerts.push("NGHIEM TRONG: luu hanh > collateral khoa. Kiem tra ngay.");
  if (feedAgeSec > 3600) alerts.push(`Chainlink feed cu ${feedAgeSec}s — so BTCx/USD o tren khong dang tin.`);
  if (Math.abs(devBps) >= alertBps) {
    alerts.push(
      devBps > 0
        ? `BTCx dat hon BTC ${devBps} bps -> co loi khi: mint BTCx tai vault (1:1) roi BAN tren pool.`
        : `BTCx re hon BTC ${-devBps} bps -> co loi khi: MUA BTCx tren pool roi redeem tai vault (1:1).`,
    );
  }

  if (alerts.length === 0) {
    console.log(`\n  Trang thai: BINH THUONG (nguong canh bao ${alertBps} bps)\n`);
  } else {
    console.log("");
    for (const a of alerts) console.log(`  >> ${a}`);
    console.log("");
    process.exitCode = 2; // de cron/CI bat duoc
  }

  void network;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
