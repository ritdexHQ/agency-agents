import * as fs from "fs";
import * as path from "path";
import { ethers, network } from "hardhat";
import { chainConfig } from "./config";
import { loadDeployment } from "./io";
import {
  WAD,
  clampNotional,
  decide,
  minOutWithSlippage,
  mintOutWei,
  netProfitWei,
  ratioFromSqrtPrice,
  withinRateLimit,
  type Direction,
  type Fees,
} from "./keeper/strategy";

/**
 * BOT GIU NEO (peg keeper) — market making that cho cap BTCx/BTCB.
 *
 * Bot lam gi: theo doi gia pool so voi ty le 1:1 cua vault. Khi pool lech du xa
 * de co lai THAT sau phi pool, phi vault va gas, no dong mot vong arbitrage keo
 * gia ve 1:1. Moi lenh deu co ly do kinh te va deu lam gia BTCx bam sat BTC hon.
 *
 * Bot KHONG lam gi — va khong lam duoc:
 *   - Khong tu sinh vi. Chay bang dung mot vi ma ban cau hinh.
 *   - Khong tu khop lenh voi chinh minh. Doi tac moi lenh la pool va vault.
 *   - Khong giao dich khi khong co bien loi nhuan. Bien am thi `decide()` tra ve
 *     "none" va ham gui lenh khong bao gio duoc goi.
 *   - Khong chay lien tuc de tao volume: gioi han toc do + nguong bien duong
 *     khien dieu do bat kha thi ve mat kinh te.
 *
 * Dung co gang sua no thanh bot tao volume gia. Volume gia lam nguoi mua hieu sai
 * do sau that cua thi truong, va CoinGecko/CMC doi chieu tinh xac thuc cua volume
 * khi xet ho so — bi phat hien la bi loai, tuc la pha dung muc tieu cua du an nay.
 *
 * Cach chay:
 *   npm run keeper:mainnet                      # mo phong, KHONG gui giao dich
 *   KEEPER_EXECUTE=1 npm run keeper:mainnet     # gui giao dich that
 *   touch keeper.stop                           # cong tac dung khan cap
 *
 * Mac dinh la mo phong co chu dich: phai co hanh dong ro rang moi tieu tien that.
 */

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];
const POOL_ABI = [
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
  "function token0() view returns (address)",
  "function liquidity() view returns (uint128)",
];
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];
const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];

interface Env {
  execute: boolean;
  minEdgeBps: number;
  maxTradeBtcb: bigint;
  maxTradesPerHour: number;
  slippageBps: number;
  reserveBnb: bigint;
  overshootBps: number;
}

function readEnv(): Env {
  return {
    // Hardhat khong chuyen tiep co CLI la cho script, nen dung bien moi truong.
    execute: process.env.KEEPER_EXECUTE === "1",
    minEdgeBps: Number(process.env.KEEPER_MIN_EDGE_BPS || 5),
    maxTradeBtcb: ethers.parseUnits(process.env.KEEPER_MAX_TRADE_BTCB || "0.0005", 18),
    maxTradesPerHour: Number(process.env.KEEPER_MAX_TRADES_PER_HOUR || 6),
    slippageBps: Number(process.env.KEEPER_SLIPPAGE_BPS || 30),
    reserveBnb: ethers.parseEther(process.env.KEEPER_RESERVE_BNB || "0.005"),
    overshootBps: Number(process.env.KEEPER_OVERSHOOT_BPS || 2),
  };
}

// --------------------------------------------------------------------------
// Nhat ky kiem toan. Moi lan chay deu ghi lai, ke ca khi khong lam gi — de sau
// nay doi chieu duoc tung lenh voi ly do kinh te cua no.
// --------------------------------------------------------------------------
const LOG = path.join(__dirname, "..", "keeper.log.jsonl");
const STATE = path.join(__dirname, "..", "keeper.state.json");

function audit(record: Record<string, unknown>): void {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

function loadTimestamps(): number[] {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8")).trades as number[];
  } catch {
    return [];
  }
}

function saveTimestamp(ts: number): void {
  const kept = [...loadTimestamps(), ts].filter((t) => t > Date.now() - 7 * 24 * 3_600_000);
  fs.writeFileSync(STATE, JSON.stringify({ trades: kept }, null, 2) + "\n");
}

async function main() {
  const env = readEnv();
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);
  if (!d.pool) throw new Error("Chua co pool. Chay scripts/03_seed_liquidity.ts truoc.");

  const [signer] = await ethers.getSigners();

  // --- Cong tac dung khan cap, kiem tra truoc moi thu ---
  const stopFile = path.join(__dirname, "..", "keeper.stop");
  if (fs.existsSync(stopFile)) {
    console.log(`\nDUNG: ton tai ${stopFile}. Xoa file do de chay lai.\n`);
    audit({ action: "halted", reason: "stop file" });
    return;
  }

  const vault = await ethers.getContractAt("BitcoinXVault", d.vault);
  const btcx = await ethers.getContractAt("BitcoinX", d.btcx);
  const btcb = new ethers.Contract(d.collateral, ERC20_ABI, signer);
  const pool = new ethers.Contract(d.pool, POOL_ABI, ethers.provider);
  const quoter = new ethers.Contract(cfg.v3Quoter, QUOTER_ABI, ethers.provider);
  const router = new ethers.Contract(cfg.v3SwapRouter, ROUTER_ABI, signer);

  const [slot0, token0, liquidity, mintFeeBps, redeemFeeBps, mintPaused, backing, btcbBal, bnbBal, feeData] =
    await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.liquidity(),
      vault.mintFeeBps(),
      vault.redeemFeeBps(),
      vault.mintPaused(),
      vault.backingRatio(),
      btcb.balanceOf(signer.address),
      ethers.provider.getBalance(signer.address),
      ethers.provider.getFeeData(),
    ]);

  const btcxIsToken0 = token0.toLowerCase() === d.btcx.toLowerCase();
  const ratio1e18 = ratioFromSqrtPrice(BigInt(slot0[0]), btcxIsToken0);
  const fees: Fees = {
    poolFeeBps: cfg.poolFee / 100, // fee tier 100 = 0,01% = 1 bps
    mintFeeBps: Number(mintFeeBps),
    redeemFeeBps: Number(redeemFeeBps),
  };

  // Gas quy ra BTCB: mot vong gom approve/mint/swap/redeem ~ 400k gas.
  const gasPrice = feeData.gasPrice ?? ethers.parseUnits("1", "gwei");
  const gasCostBnb = gasPrice * 400_000n;
  // Quy doi BNB -> BTCB qua gia BTC/USD cua Chainlink va gia BNB. O day ta don
  // gian hoa: lay gasCostBnb theo ty le BNB/BTC uoc luong tu bien moi truong,
  // mac dinh 0,01 (1 BNB ~ 0,01 BTC). Dat KEEPER_BNB_PER_BTC cho chinh xac hon.
  const bnbPerBtc = ethers.parseUnits(process.env.KEEPER_BNB_PER_BTC || "0.0094", 18);
  const gasCostWei = (gasCostBnb * bnbPerBtc) / WAD;

  const notional = clampNotional({
    desiredWei: env.maxTradeBtcb,
    balanceWei: btcbBal,
    maxPerTradeWei: env.maxTradeBtcb,
  });

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`\n[${stamp}] peg keeper — ${cfg.name} (${network.name})`);
  console.log(`  che do          : ${env.execute ? "GUI LENH THAT" : "mo phong (dat KEEPER_EXECUTE=1 de gui that)"}`);
  console.log(`  vi              : ${signer.address}`);
  console.log(`  so du           : ${ethers.formatUnits(btcbBal, 18)} BTCB · ${ethers.formatEther(bnbBal)} BNB`);
  console.log(`  BTCx/BTCB pool  : ${ethers.formatUnits(ratio1e18, 18).slice(0, 12)}`);
  console.log(`  thanh khoan     : ${liquidity}`);
  console.log(`  phi             : pool ${fees.poolFeeBps} bps · mint ${fees.mintFeeBps} bps · redeem ${fees.redeemFeeBps} bps`);
  console.log(`  gas mot vong    : ~${ethers.formatUnits(gasCostWei, 18)} BTCB`);
  console.log(`  quy mo lenh     : ${ethers.formatUnits(notional, 18)} BTCB`);

  const decision = decide({
    ratio1e18,
    fees,
    minEdgeBps: env.minEdgeBps,
    gasCostWei,
    notionalWei: notional,
    mintPaused,
    backingRatio1e18: backing,
  });

  console.log(`  quyet dinh      : ${decision.direction} — ${decision.reason}`);

  if (decision.direction === "none") {
    audit({ action: "idle", ratio: ratio1e18.toString(), decision });
    console.log("");
    return;
  }

  if (bnbBal < env.reserveBnb) {
    console.log(`  DUNG: BNB con ${ethers.formatEther(bnbBal)} < muc du tru ${ethers.formatEther(env.reserveBnb)}\n`);
    audit({ action: "blocked", reason: "bnb below reserve", decision });
    return;
  }

  const stamps = loadTimestamps();
  if (!withinRateLimit(stamps, env.maxTradesPerHour, Date.now())) {
    console.log(`  DUNG: da dat gioi han ${env.maxTradesPerHour} lenh/gio\n`);
    audit({ action: "blocked", reason: "rate limit", decision });
    return;
  }

  // --- Chon quy mo lenh bang mo phong qua Quoter (staticcall, khong ton gas) ---
  const direction = decision.direction as Exclude<Direction, "none">;
  const tokenIn = direction === "mint_vault_sell_pool" ? d.btcx : d.collateral;
  const tokenOut = direction === "mint_vault_sell_pool" ? d.collateral : d.btcx;
  // Dai ha canh quanh 1:1. Giu HEP co chu dich: neu cho phep dung ngay mep
  // mot dai rong, lenh nay se de lai mot do lech nguoc du lon de lenh sau danh
  // nguoc lai — churn khong tao ra gia tri gi, chi ton phi va sinh volume vo nghia.
  // Hep hon nguong `minEdgeBps` nghia la sau khi dong xong, bot tu im.
  const overshootBand = (WAD * BigInt(env.overshootBps)) / 10_000n;

  interface Candidate {
    notional: bigint;
    swapIn: bigint;
    quotedOut: bigint;
    ratioAfter: bigint;
    profit: bigint;
    overshoots: boolean;
  }

  async function evaluate(size: bigint): Promise<Candidate | null> {
    if (size <= 0n) return null;
    const swapIn = direction === "mint_vault_sell_pool" ? mintOutWei(size, fees) : size;
    if (swapIn <= 0n) return null;
    try {
      const q = await quoter.quoteExactInputSingle.staticCall({
        tokenIn,
        tokenOut,
        amountIn: swapIn,
        fee: cfg.poolFee,
        sqrtPriceLimitX96: 0n,
      });
      const quotedOut: bigint = q[0];
      const ratioAfter = ratioFromSqrtPrice(BigInt(q[1]), btcxIsToken0);
      return {
        notional: size,
        swapIn,
        quotedOut,
        ratioAfter,
        profit: netProfitWei({ direction, amountInWei: size, quotedOutWei: quotedOut, fees, gasCostWei }),
        overshoots:
          direction === "mint_vault_sell_pool"
            ? ratioAfter < WAD - overshootBand
            : ratioAfter > WAD + overshootBand,
      };
    } catch {
      // Quoter revert (thuong la het thanh khoan trong dai) -> coi nhu khong dung duoc.
      return null;
    }
  }

  // Tim quy mo lon nhat KHONG day gia vuot qua 1:1.
  //
  // Tac dong gia don dieu theo quy mo lenh, nen vi tri "vua dung dong het do
  // lech" tim duoc bang chia doi. Thang bac co dinh khong dung o day: voi pool
  // vai tram do, quy mo hop ly co the nho hon tran cau hinh hang tram lan, va
  // mot thang bac 5 buoc se bo qua no hoan toan.
  const DUST = 10n ** 9n; // duoi muc nay thi lenh vo nghia
  const candidates: Candidate[] = [];

  const full = await evaluate(notional);
  if (full) candidates.push(full);

  if (!full || full.overshoots) {
    let lo = 0n; // luon khong vuot da
    let hi = notional; // co the vuot da
    for (let i = 0; i < 24 && hi - lo > DUST; i++) {
      const mid = (lo + hi) / 2n;
      if (mid <= 0n) break;
      const c = await evaluate(mid);
      if (c && !c.overshoots) lo = mid;
      else hi = mid;
    }
    // Danh gia loi nhuan tai bien tim duoc va vai muc nho hon: quy mo lon nhat
    // chua chac lai nhieu nhat, vi gas co dinh con phi pool thi tang theo quy mo.
    for (const num of [4n, 3n, 2n]) {
      const size = (lo * num) / 4n;
      if (size < DUST) continue;
      const c = await evaluate(size);
      if (c) candidates.push(c);
    }
  }

  const viable = candidates.filter((c) => !c.overshoots && c.profit > 0n);
  console.log(`  mo phong        : thu ${candidates.length} quy mo, ${viable.length} phuong an dung duoc`);
  for (const c of candidates) {
    const flag = c.overshoots ? "vuot da" : c.profit > 0n ? "OK" : "lo";
    console.log(
      `      ${ethers.formatUnits(c.notional, 18).padEnd(14)} -> lai ${ethers
        .formatUnits(c.profit, 18)
        .padEnd(22)} gia sau ${ethers.formatUnits(c.ratioAfter, 18).slice(0, 10)}  ${flag}`,
    );
  }

  if (viable.length === 0) {
    const why = candidates.every((c) => c.overshoots)
      ? "moi quy mo deu day gia vuot qua 1:1 — thanh khoan pool qua mong"
      : "khong quy mo nao co lai sau phi va gas";
    console.log(`  DUNG: ${why}. Khong gui lenh.\n`);
    audit({ action: "rejected", reason: why, decision });
    return;
  }

  const best = viable.reduce((a, b) => (b.profit > a.profit ? b : a));
  const { swapIn, quotedOut, ratioAfter, profit } = best;

  console.log(`  chon quy mo     : ${ethers.formatUnits(best.notional, 18)} BTCB`);
  console.log(`  gia sau lenh    : ${ethers.formatUnits(ratioAfter, 18).slice(0, 12)} (tu ${ethers.formatUnits(ratio1e18, 18).slice(0, 12)})`);
  console.log(`  lai rong du kien: ${ethers.formatUnits(profit, 18)} BTCB`);

  if (!env.execute) {
    console.log(`\n  Ket thuc o che do mo phong. Dat KEEPER_EXECUTE=1 de gui lenh that.\n`);
    audit({ action: "dry-run", profit: profit.toString(), decision });
    return;
  }

  // --- Gui lenh that ---
  const minOut = minOutWithSlippage(quotedOut, env.slippageBps);
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const hashes: string[] = [];

  const ensureAllowance = async (token: string, spender: string, need: bigint) => {
    const c = new ethers.Contract(token, ERC20_ABI, signer);
    if ((await c.allowance(signer.address, spender)) < need) {
      const tx = await c.approve(spender, ethers.MaxUint256);
      hashes.push((await tx.wait())!.hash);
    }
  };

  if (direction === "mint_vault_sell_pool") {
    await ensureAllowance(d.collateral, d.vault, best.notional);
    hashes.push((await (await vault.mint(best.notional, signer.address)).wait())!.hash);

    await ensureAllowance(d.btcx, cfg.v3SwapRouter, swapIn);
    hashes.push(
      (await (
        await router.exactInputSingle({
          tokenIn,
          tokenOut,
          fee: cfg.poolFee,
          recipient: signer.address,
          amountIn: swapIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        })
      ).wait())!.hash,
    );
  } else {
    await ensureAllowance(d.collateral, cfg.v3SwapRouter, swapIn);
    const before = await btcx.balanceOf(signer.address);
    hashes.push(
      (await (
        await router.exactInputSingle({
          tokenIn,
          tokenOut,
          fee: cfg.poolFee,
          recipient: signer.address,
          amountIn: swapIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        })
      ).wait())!.hash,
    );
    const received = (await btcx.balanceOf(signer.address)) - before;
    hashes.push((await (await vault.redeem(received, signer.address)).wait())!.hash);
  }

  const btcbAfter = await btcb.balanceOf(signer.address);
  const realised = btcbAfter - btcbBal;

  saveTimestamp(Date.now());
  audit({
    action: "executed",
    direction,
    notional: best.notional.toString(),
    expectedProfit: profit.toString(),
    realisedBtcbDelta: realised.toString(),
    ratioBefore: ratio1e18.toString(),
    ratioAfterQuoted: ratioAfter.toString(),
    txs: hashes,
    deadline,
  });

  console.log(`\n  Da gui ${hashes.length} giao dich.`);
  for (const h of hashes) console.log(`    ${cfg.explorer}/tx/${h}`);
  console.log(`  Thay doi so du BTCB: ${ethers.formatUnits(realised, 18)}`);
  console.log(`  Nhat ky: keeper.log.jsonl\n`);
}

main().catch((e) => {
  audit({ action: "error", message: String(e instanceof Error ? e.message : e) });
  console.error(e);
  process.exitCode = 1;
});
