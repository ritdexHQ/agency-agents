import { ethers, network } from "hardhat";
import { chainConfig } from "./config";
import { loadDeployment, updateDeployment } from "./io";

const Q96 = 2n ** 96n;
/** sqrtPriceX96 ung voi ty gia 1:1 (ca hai token deu 18 decimals). */
const SQRT_PRICE_1_1 = Q96;

const NPM_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];
const FACTORY_ABI = [
  "function getPool(address,address,uint24) view returns (address)",
  "function feeAmountTickSpacing(uint24) view returns (int24)",
];
const POOL_ABI = ["function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)"];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

/** tick ung voi do lech `bps` quanh gia 1:1: tick = ln(1 + bps/10000) / ln(1.0001) */
function bpsToTick(bps: number, tickSpacing: number): number {
  const raw = Math.log(1 + bps / 10_000) / Math.log(1.0001);
  const aligned = Math.round(raw / tickSpacing) * tickSpacing;
  return Math.max(aligned, tickSpacing);
}

/**
 * Tao pool PancakeSwap V3 BTCx/BTCB va nap thanh khoan TAP TRUNG quanh ty gia 1:1.
 *
 * Vi sao V3 chu khong phai V2: voi ngan sach nho, V2 trai von tu 0 den vo cuc nen
 * do sau thuc te gan nhu bang khong. V3 cho phep don toan bo von vao dai +-0.30%
 * quanh 1:1 — dung dai duy nhat ma gia co the giao dich khi vault luon san sang
 * doi 1:1. Cung mot so tien, do sau tai vung gia thuc te cao hon hang tram lan.
 */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);
  const [signer] = await ethers.getSigners();

  const totalBtcb = ethers.parseUnits(process.env.LP_BTCB_TOTAL || "0", 18);
  const bandBps = Number(process.env.LP_BAND_BPS || 100);
  if (totalBtcb === 0n) throw new Error("Dat LP_BTCB_TOTAL trong .env, vi du LP_BTCB_TOTAL=0.0012");
  if (bandBps < 1 || bandBps > 2000) throw new Error("LP_BAND_BPS phai trong khoang 1..2000");

  const btcb = new ethers.Contract(d.collateral, ERC20_ABI, signer);
  const btcx = await ethers.getContractAt("BitcoinX", d.btcx);
  const vault = await ethers.getContractAt("BitcoinXVault", d.vault);
  const factory = new ethers.Contract(cfg.v3Factory, FACTORY_ABI, signer);
  const npm = new ethers.Contract(cfg.v3PositionManager, NPM_ABI, signer);

  const held = await btcb.balanceOf(signer.address);
  console.log(`\nSo du BTCB     : ${ethers.formatUnits(held, 18)}`);
  console.log(`Dua vao LP     : ${ethers.formatUnits(totalBtcb, 18)} BTCB (mot nua se doi thanh BTCx)`);
  console.log(`Dai gia        : +-${bandBps} bps quanh 1:1`);
  if (held < totalBtcb) throw new Error("Khong du BTCB trong vi.");

  // --- 1. Doi mot nua BTCB lay BTCx qua vault (ty le 1:1) ---
  const half = totalBtcb / 2n;
  if ((await btcx.balanceOf(signer.address)) < half) {
    const needed = half - (await btcx.balanceOf(signer.address));
    if ((await btcb.allowance(signer.address, d.vault)) < needed) {
      await (await btcb.approve(d.vault, ethers.MaxUint256)).wait();
    }
    console.log(`\nMint ${ethers.formatUnits(needed, 18)} BTCx tu vault...`);
    await (await vault.mint(needed, signer.address)).wait();
  }

  // --- 2. Sap xep token theo dia chi (quy uoc Uniswap/Pancake V3) ---
  const btcxAddr = d.btcx.toLowerCase();
  const btcbAddr = d.collateral.toLowerCase();
  const btcxIsToken0 = btcxAddr < btcbAddr;
  const [token0, token1] = btcxIsToken0 ? [d.btcx, d.collateral] : [d.collateral, d.btcx];

  const tickSpacing = Number(await factory.feeAmountTickSpacing(cfg.poolFee));
  if (tickSpacing === 0) throw new Error(`Fee tier ${cfg.poolFee} khong ton tai tren factory nay.`);
  const width = bpsToTick(bandBps, tickSpacing);
  const tickLower = -width;
  const tickUpper = width;

  console.log(`\ntoken0         : ${token0} ${btcxIsToken0 ? "(BTCx)" : "(BTCB)"}`);
  console.log(`token1         : ${token1} ${btcxIsToken0 ? "(BTCB)" : "(BTCx)"}`);
  console.log(`fee tier       : ${cfg.poolFee} (${cfg.poolFee / 10_000}%), tickSpacing ${tickSpacing}`);
  console.log(`tick range     : [${tickLower}, ${tickUpper}]`);

  // --- 3. Tao pool neu chua co, khoi tao tai dung ty gia 1:1 ---
  let pool: string = await factory.getPool(token0, token1, cfg.poolFee);
  if (pool === ethers.ZeroAddress) {
    console.log(`\nTao pool moi tai ty gia 1:1...`);
    await (await npm.createAndInitializePoolIfNecessary(token0, token1, cfg.poolFee, SQRT_PRICE_1_1)).wait();
    pool = await factory.getPool(token0, token1, cfg.poolFee);
  } else {
    const [sqrtPriceX96] = await new ethers.Contract(pool, POOL_ABI, signer).slot0();
    const ratio1e18 = (BigInt(sqrtPriceX96) * BigInt(sqrtPriceX96) * 10n ** 18n) / (Q96 * Q96);
    const devBps = Number((ratio1e18 - 10n ** 18n) * 10_000n / 10n ** 18n);
    console.log(`\nPool da ton tai: ${pool} (lech ${devBps} bps so voi 1:1)`);
    if (Math.abs(devBps) > bandBps) {
      throw new Error(
        `Gia pool dang lech ${devBps} bps, nam ngoai dai +-${bandBps} bps. ` +
          `Arbitrage ve 1:1 qua vault truoc (npm run peg:mainnet), roi chay lai.`,
      );
    }
  }
  console.log(`Pool           : ${cfg.explorer}/address/${pool}`);

  // --- 4. Approve va mint vi the ---
  for (const [addr, name] of [[d.collateral, "BTCB"], [d.btcx, "BTCx"]] as const) {
    const token = new ethers.Contract(addr, ERC20_ABI, signer);
    if ((await token.allowance(signer.address, cfg.v3PositionManager)) < half) {
      console.log(`Approve ${name} cho PositionManager...`);
      await (await token.approve(cfg.v3PositionManager, ethers.MaxUint256)).wait();
    }
  }

  // Dai doi xung quanh 1:1 nen hai ben can luong gan bang nhau.
  // amountMin = 90% de chiu duoc lam tron tick, nhung khong de truot gia that.
  const amount0Desired = half;
  const amount1Desired = half;
  const minOf = (x: bigint) => (x * 90n) / 100n;

  console.log(`\nNap thanh khoan: ${ethers.formatUnits(half, 18)} moi ben...`);
  const tx = await npm.mint({
    token0,
    token1,
    fee: cfg.poolFee,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min: minOf(amount0Desired),
    amount1Min: minOf(amount1Desired),
    recipient: signer.address,
    deadline: Math.floor(Date.now() / 1000) + 1200,
  });
  const receipt = await tx.wait();

  // tokenId nam trong event Transfer cua NFT position manager (from = 0x0).
  let tokenId: string | undefined;
  for (const log of receipt!.logs) {
    if (log.address.toLowerCase() === cfg.v3PositionManager.toLowerCase() && log.topics.length === 4) {
      if (log.topics[1] === ethers.ZeroHash) tokenId = BigInt(log.topics[3]).toString();
    }
  }

  updateDeployment(chainId, { pool, positionTokenId: tokenId });

  console.log(`\nXong. tx ${cfg.explorer}/tx/${receipt!.hash}`);
  console.log(`Position NFT   : #${tokenId ?? "?"}`);
  console.log(`\nKiem tra gia hien len o:`);
  console.log(`  https://dexscreener.com/bsc/${pool}`);
  console.log(`  https://pancakeswap.finance/swap?inputCurrency=${d.collateral}&outputCurrency=${d.btcx}&chain=${network.name === "bsc" ? "bsc" : "bscTestnet"}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
