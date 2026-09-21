import { ethers } from "hardhat";
import { chainConfig } from "./config";
import { loadDeployment } from "./io";

/**
 * Bao cao tinh trang tren DEX Screener: da duoc index chua, co gia chua, va
 * ho so token (logo/website/social) da hien chua.
 *
 * DEX Screener index TU DONG moi cap co pool thanh khoan va it nhat mot giao
 * dich — mien phi, khong can nop don, thuong trong vai phut. Nhung LOGO va
 * social thi khong tu dong: chung den tu mot token list duoc ho ho tro (nhu
 * CoinGecko) hoac tu goi Enhanced Token Info tra phi.
 *
 * Script nay chi DOC API cong khai. Khong gui gi, khong tra tien gi.
 *
 *   npm run ds:mainnet
 *
 * Thoat ma 2 khi cap chua duoc index — de cron/CI bat duoc.
 */

const API = "https://api.dexscreener.com";
const TIMEOUT_MS = 15_000;

interface DsPair {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: Record<string, number>;
  txns?: Record<string, { buys?: number; sells?: number }>;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: Array<{ url?: string }>; socials?: Array<{ type?: string; url?: string }> };
  boosts?: { active?: number };
}

interface DsOrder {
  type?: string;
  status?: string;
  paymentTimestamp?: number;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} tu ${url}`);
  return res.json();
}

const yes = (ok: boolean) => (ok ? "  OK  " : "  --  ");

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);
  const token = ethers.getAddress(d.btcx);
  // DEX Screener dung ten chuoi rieng, khong phai chainId so.
  const dsChain = Number(chainId) === 56 ? "bsc" : Number(chainId) === 97 ? "bsc" : null;

  console.log(`\nDEX Screener — BitcoinX (BTCx) tren ${cfg.name}`);
  console.log(`Token: ${token}\n`);

  if (!dsChain) {
    console.log("DEX Screener khong index mang nay. Chi co y nghia tren mainnet.\n");
    return;
  }

  // --- 1. Cap giao dich ---
  let pairs: DsPair[] = [];
  try {
    const data = (await getJson(`${API}/latest/dex/tokens/${token}`)) as { pairs?: DsPair[] | null };
    pairs = data?.pairs ?? [];
  } catch (e) {
    console.log(`Khong goi duoc API DEX Screener: ${e instanceof Error ? e.message : e}`);
    console.log(`Kiem tra thu cong: https://dexscreener.com/${dsChain}/${d.pool ?? token}\n`);
    process.exitCode = 1;
    return;
  }

  if (pairs.length === 0) {
    console.log("CHUA DUOC INDEX.\n");
    console.log("DEX Screener index tu dong khi cap co pool thanh khoan VA it nhat mot giao dich.");
    console.log("Thuong mat vai phut. Neu da lau ma chua thay:");
    console.log("  - Da tao pool chua?            npm run pool:mainnet");
    console.log("  - Da co giao dich nao chua?    npm run bootstrap:mainnet");
    console.log(`  - Xem truc tiep: https://dexscreener.com/${dsChain}/${d.pool ?? token}\n`);
    process.exitCode = 2;
    return;
  }

  // Uu tien dung cap ma minh da tao.
  const mine = d.pool
    ? pairs.find((p) => p.pairAddress?.toLowerCase() === d.pool!.toLowerCase())
    : undefined;
  const pair = mine ?? pairs[0];

  console.log(`DA DUOC INDEX — ${pairs.length} cap\n`);
  console.log(`  cap             : ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol} tren ${pair.dexId}`);
  console.log(`  dia chi cap     : ${pair.pairAddress}`);
  console.log(`  gia USD         : ${pair.priceUsd ?? "—"}`);
  console.log(`  gia theo quote  : ${pair.priceNative ?? "—"} ${pair.quoteToken?.symbol ?? ""}`);
  console.log(`  thanh khoan     : $${(pair.liquidity?.usd ?? 0).toLocaleString()}`);
  console.log(`  khoi luong 24h  : $${(pair.volume?.h24 ?? 0).toLocaleString()}`);
  console.log(`  giao dich 24h   : ${(pair.txns?.h24?.buys ?? 0)} mua / ${(pair.txns?.h24?.sells ?? 0)} ban`);
  if (pair.pairCreatedAt) {
    const days = (Date.now() - pair.pairCreatedAt) / 86_400_000;
    console.log(`  tuoi cap        : ${days.toFixed(1)} ngay`);
  }
  console.log(`  trang           : ${pair.url ?? `https://dexscreener.com/${dsChain}/${pair.pairAddress}`}`);

  // --- 2. Ho so token: logo, website, social ---
  const hasLogo = Boolean(pair.info?.imageUrl);
  const hasSite = (pair.info?.websites?.length ?? 0) > 0;
  const hasSocial = (pair.info?.socials?.length ?? 0) > 0;

  console.log(`\nHo so token:`);
  console.log(`${yes(hasLogo)} logo        ${pair.info?.imageUrl ?? "chua co"}`);
  console.log(`${yes(hasSite)} website     ${pair.info?.websites?.[0]?.url ?? "chua co"}`);
  console.log(
    `${yes(hasSocial)} social      ${(pair.info?.socials ?? []).map((s) => s.type).join(", ") || "chua co"}`,
  );
  if ((pair.boosts?.active ?? 0) > 0) {
    console.log(`  boosts dang hoat dong: ${pair.boosts?.active}`);
  }

  // --- 3. Trang thai don Enhanced Token Info (neu da mua) ---
  try {
    const orders = (await getJson(`${API}/orders/v1/${dsChain}/${token}`)) as DsOrder[];
    if (Array.isArray(orders) && orders.length > 0) {
      console.log(`\nDon da mua tren DEX Screener:`);
      for (const o of orders) {
        const when = o.paymentTimestamp ? new Date(o.paymentTimestamp).toISOString().slice(0, 16) : "—";
        console.log(`  ${String(o.type).padEnd(18)} ${String(o.status).padEnd(12)} ${when}`);
      }
    } else {
      console.log(`\nChua co don nao tren DEX Screener (chua mua Enhanced Token Info).`);
    }
  } catch (e) {
    console.log(`\nKhong doc duoc trang thai don: ${e instanceof Error ? e.message : e}`);
  }

  // --- 4. Viec can lam ---
  console.log(`\nViec can lam:`);
  if (!hasLogo) {
    console.log(`  - Logo chua hien. DEX Screener lay logo tu token list duoc ho tro (vi du`);
    console.log(`    CoinGecko), hoac tu goi Enhanced Token Info tra phi (~$299, xu ly`);
    console.log(`    thuong duoi 15 phut): https://marketplace.dexscreener.com/product/token-info`);
    console.log(`    Bo qua CoinGecko thi Enhanced Token Info la duong duy nhat.`);
  }
  if ((pair.liquidity?.usd ?? 0) < 500) {
    console.log(`  - Thanh khoan $${(pair.liquidity?.usd ?? 0).toFixed(0)} rat mong. Gia hien thi that,`);
    console.log(`    nhung mot lenh vai tram do se lam lech gia manh.`);
  }
  if ((pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0) === 0) {
    console.log(`  - Khong co giao dich nao trong 24h. Trang van song, nhung bieu do phang.`);
  }
  if (hasLogo && hasSite && hasSocial) {
    console.log(`  - Khong con gi. Ho so day du.`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
