import { ethers, network } from "hardhat";
import { chainConfig } from "./config";
import { loadDeployment } from "./io";
import { minOutWithSlippage, ratioFromSqrtPrice, WAD } from "./keeper/strategy";

/**
 * MOT giao dich swap that de kich hoat cac bo index.
 *
 * DEX Screener index tu dong moi cap co pool thanh khoan VA it nhat mot giao
 * dich. Pool vua tao thi chua co giao dich nao, nen cap khong xuat hien. Script
 * nay dong dung mot lenh swap nho, o dung gia thi truong, tra dung phi pool.
 *
 * Day KHONG phai tao volume: no chay dung mot lan, va tu tu choi neu pool da
 * tung co giao dich. Neu ban thay minh muon chay no lan thu hai, dieu ban dang
 * nghi den la wash trading — doc `docs/06-bot-giu-neo.md`.
 *
 *   npm run bootstrap:mainnet                     # mo phong
 *   BOOTSTRAP_EXECUTE=1 npm run bootstrap:mainnet # gui lenh that
 */

const POOL_ABI = [
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
  "function token0() view returns (address)",
  "function liquidity() view returns (uint128)",
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];
const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);
  if (!d.pool) throw new Error("Chua co pool. Chay scripts/03_seed_liquidity.ts truoc.");

  const [signer] = await ethers.getSigners();
  const execute = process.env.BOOTSTRAP_EXECUTE === "1";
  const amountIn = ethers.parseUnits(process.env.BOOTSTRAP_BTCB || "0.00002", 18);
  const slippageBps = Number(process.env.BOOTSTRAP_SLIPPAGE_BPS || 100);

  const pool = new ethers.Contract(d.pool, POOL_ABI, ethers.provider);
  const btcb = new ethers.Contract(d.collateral, ERC20_ABI, signer);
  const quoter = new ethers.Contract(cfg.v3Quoter, QUOTER_ABI, ethers.provider);
  const router = new ethers.Contract(cfg.v3SwapRouter, ROUTER_ABI, signer);

  const [slot0, token0, liquidity, fg0, fg1, balance] = await Promise.all([
    pool.slot0(),
    pool.token0(),
    pool.liquidity(),
    pool.feeGrowthGlobal0X128(),
    pool.feeGrowthGlobal1X128(),
    btcb.balanceOf(signer.address),
  ]);

  const btcxIsToken0 = token0.toLowerCase() === d.btcx.toLowerCase();
  const ratio = ratioFromSqrtPrice(BigInt(slot0[0]), btcxIsToken0);

  console.log(`\nKhoi dong chi so cho cap BTCx/${"BTCB"} — ${cfg.name} (${network.name})`);
  console.log(`  che do          : ${execute ? "GUI LENH THAT" : "mo phong (dat BOOTSTRAP_EXECUTE=1 de gui that)"}`);
  console.log(`  pool            : ${d.pool}`);
  console.log(`  thanh khoan     : ${liquidity}`);
  console.log(`  gia BTCx/BTCB   : ${ethers.formatUnits(ratio, 18).slice(0, 12)}`);
  console.log(`  so du BTCB      : ${ethers.formatUnits(balance, 18)}`);
  console.log(`  quy mo lenh     : ${ethers.formatUnits(amountIn, 18)} BTCB`);

  // --- Chan chay lai. Phi pool chi tang khi da co swap; nap thanh khoan thi khong. ---
  if (BigInt(fg0) > 0n || BigInt(fg1) > 0n) {
    console.log(`\n  DUNG: pool da tung co giao dich (feeGrowthGlobal khac 0).`);
    console.log(`  Viec khoi dong chi so da xong. Kiem tra: npm run ds:${network.name === "bsc" ? "mainnet" : "testnet"}`);
    console.log(`  Chay them lenh nua chi de "tao vol" la wash trading — xem docs/06-bot-giu-neo.md\n`);
    return;
  }

  if (liquidity === 0n) throw new Error("Pool khong co thanh khoan trong dai gia hien tai.");
  if (balance < amountIn) throw new Error("Khong du BTCB trong vi.");

  // --- Mo phong ---
  const quote = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: d.collateral,
    tokenOut: d.btcx,
    amountIn,
    fee: cfg.poolFee,
    sqrtPriceLimitX96: 0n,
  });
  const out: bigint = quote[0];
  const ratioAfter = ratioFromSqrtPrice(BigInt(quote[1]), btcxIsToken0);
  const impactBps = Number(((ratioAfter - ratio) * 10_000n) / WAD);

  console.log(`\n  mo phong        : ${ethers.formatUnits(amountIn, 18)} BTCB -> ${ethers.formatUnits(out, 18)} BTCx`);
  console.log(`  gia sau lenh    : ${ethers.formatUnits(ratioAfter, 18).slice(0, 12)} (tac dong ${impactBps} bps)`);

  if (out === 0n) throw new Error("Bao gia tra ve 0 — quy mo qua nho hoac pool khong co thanh khoan.");
  if (Math.abs(impactBps) > 200) {
    throw new Error(
      `Lenh nay lam lech gia ${impactBps} bps. Giam BOOTSTRAP_BTCB — muc dich chi la tao mot giao dich, khong phai doi gia.`,
    );
  }

  if (!execute) {
    console.log(`\n  Ket thuc o che do mo phong. Dat BOOTSTRAP_EXECUTE=1 de gui lenh that.\n`);
    return;
  }

  if ((await btcb.allowance(signer.address, cfg.v3SwapRouter)) < amountIn) {
    console.log(`  Approve BTCB cho SwapRouter...`);
    await (await btcb.approve(cfg.v3SwapRouter, ethers.MaxUint256)).wait();
  }

  const receipt = await (
    await router.exactInputSingle({
      tokenIn: d.collateral,
      tokenOut: d.btcx,
      fee: cfg.poolFee,
      recipient: signer.address,
      amountIn,
      amountOutMinimum: minOutWithSlippage(out, slippageBps),
      sqrtPriceLimitX96: 0n,
    })
  ).wait();

  console.log(`\n  Xong. tx ${cfg.explorer}/tx/${receipt!.hash}`);
  console.log(`\n  DEX Screener thuong index trong vai phut:`);
  console.log(`    https://dexscreener.com/bsc/${d.pool}`);
  console.log(`  Kiem tra bang: npm run ds:${network.name === "bsc" ? "mainnet" : "testnet"}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
