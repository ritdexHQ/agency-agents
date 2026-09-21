/**
 * Logic quyet dinh cua bot giu neo — thuan tuy, khong cham mang.
 *
 * Tach rieng de kiem thu duoc bang unit test: moi phep tinh loi nhuan va moi
 * nguong an toan deu chay duoc offline, khong can node va khong ton gas.
 *
 * Nguyen tac thiet ke quan trong nhat: bot CHI giao dich khi chenh lech gia
 * du lon de co lai THAT sau khi tru phi pool, phi vault va gas. Nghia la no
 * khong the chay lien tuc de tao volume — moi lenh khong co bien duong deu bi
 * tu choi ngay tai day. Day la rang buoc kinh te, khong phai loi khuyen.
 */

export const WAD = 10n ** 18n;
export const BPS = 10_000n;
/** 2**96 — thang do gia cua Uniswap/PancakeSwap V3. */
export const Q96 = 2n ** 96n;

/**
 * Doi `sqrtPriceX96` cua pool V3 thanh so BTCB doi duoc cho 1 BTCx, thang 1e18.
 *
 * Pool bao gia token1 tren token0, nen phai biet BTCx nam o vi tri nao. Nham
 * thu tu la dao nguoc toan bo tin hieu — bot se arbitrage sai huong. Vi vay
 * phep tinh nay duoc tach ra va kiem thu rieng o ca hai thu tu.
 *
 * Gia dinh ca hai token deu 18 decimals (BTCx va BTCB tren BSC).
 */
export function ratioFromSqrtPrice(sqrtPriceX96: bigint, btcxIsToken0: boolean): bigint {
  if (sqrtPriceX96 <= 0n) return 0n;
  const token1PerToken0 = (sqrtPriceX96 * sqrtPriceX96 * WAD) / (Q96 * Q96);
  if (token1PerToken0 === 0n) return 0n;
  return btcxIsToken0 ? token1PerToken0 : (WAD * WAD) / token1PerToken0;
}

/** Huong arbitrage. */
export type Direction =
  /** BTCx dang RE hon 1 BTCB tren pool: mua tren pool -> redeem 1:1 tai vault. */
  | "buy_pool_redeem_vault"
  /** BTCx dang DAT hon 1 BTCB tren pool: mint 1:1 tai vault -> ban tren pool. */
  | "mint_vault_sell_pool"
  /** Trong nguong — khong lam gi. */
  | "none";

export interface Fees {
  /** Phi pool PancakeSwap V3, don vi bps (100 = 0,01%). */
  poolFeeBps: number;
  /** Phi mint cua vault, bps. */
  mintFeeBps: number;
  /** Phi redeem cua vault, bps. */
  redeemFeeBps: number;
}

/** Tru phi theo bps, luon lam tron xuong. */
export function applyFeeBps(amount: bigint, feeBps: number): bigint {
  if (feeBps < 0) throw new RangeError("feeBps am");
  return amount - (amount * BigInt(feeBps)) / BPS;
}

/**
 * Do lech neo theo bps. Duong = BTCx dat hon BTC, am = re hon.
 * @param ratio1e18 So BTCB doi duoc cho 1 BTCx tren pool, thang 1e18.
 */
export function deviationBps(ratio1e18: bigint): number {
  return Number(((ratio1e18 - WAD) * BPS) / WAD);
}

/**
 * Nguong hoa von: duoi muc nay thi arbitrage LO, du gia co lech.
 *
 * Gom phi pool + phi vault (mint hoac redeem tuy huong) + gas quy ra bps tren
 * quy mo lenh. Gas cang lon so voi lenh thi nguong cang cao — day la ly do lenh
 * nho khong bao gio co lai, va cung la ly do bot khong the spam lenh nho.
 */
export function breakEvenBps(
  fees: Fees,
  direction: Exclude<Direction, "none">,
  gasCostWei: bigint,
  notionalWei: bigint,
): number {
  if (notionalWei <= 0n) return Number.POSITIVE_INFINITY;
  const vaultFeeBps = direction === "mint_vault_sell_pool" ? fees.mintFeeBps : fees.redeemFeeBps;
  const gasBps = Number((gasCostWei * BPS) / notionalWei);
  return fees.poolFeeBps + vaultFeeBps + gasBps;
}

export interface Decision {
  direction: Direction;
  deviationBps: number;
  breakEvenBps: number;
  /** Do lech con lai sau khi tru chi phi. Duong moi dang xet den. */
  edgeBps: number;
  reason: string;
}

export interface DecideInput {
  ratio1e18: bigint;
  fees: Fees;
  /** Nguong toi thieu de dong tay, TREN muc hoa von. */
  minEdgeBps: number;
  gasCostWei: bigint;
  notionalWei: bigint;
  /** Vault dang tam dung mint — chan huong can mint. */
  mintPaused: boolean;
  /** Do bao chung cua vault, thang 1e18. Duoi 100% thi dung het. */
  backingRatio1e18: bigint;
}

/**
 * Quyet dinh co giao dich hay khong. Tra ve `none` kem ly do trong moi truong
 * hop khong chac chan — bot im lang la trang thai mac dinh dung.
 */
export function decide(input: DecideInput): Decision {
  const dev = deviationBps(input.ratio1e18);
  const idle = (reason: string): Decision => ({
    direction: "none",
    deviationBps: dev,
    breakEvenBps: 0,
    edgeBps: 0,
    reason,
  });

  if (input.backingRatio1e18 < WAD) {
    return idle("vault thieu bao chung — dung het, dieu tra truoc");
  }
  if (input.ratio1e18 <= 0n) {
    return idle("gia pool khong hop le");
  }
  if (input.notionalWei <= 0n) {
    return idle("quy mo lenh bang khong");
  }

  const direction: Exclude<Direction, "none"> =
    dev > 0 ? "mint_vault_sell_pool" : "buy_pool_redeem_vault";

  if (direction === "mint_vault_sell_pool" && input.mintPaused) {
    return idle("BTCx dat hon BTC nhung vault dang tam dung mint");
  }

  const be = breakEvenBps(input.fees, direction, input.gasCostWei, input.notionalWei);
  const edge = Math.abs(dev) - be;

  if (edge < input.minEdgeBps) {
    return {
      direction: "none",
      deviationBps: dev,
      breakEvenBps: be,
      edgeBps: edge,
      reason:
        `lech ${dev} bps, hoa von ${be.toFixed(1)} bps -> bien ${edge.toFixed(1)} bps ` +
        `< nguong ${input.minEdgeBps} bps`,
    };
  }

  return {
    direction,
    deviationBps: dev,
    breakEvenBps: be,
    edgeBps: edge,
    reason: `lech ${dev} bps, bien rong ${edge.toFixed(1)} bps sau chi phi`,
  };
}

/**
 * Loi nhuan rong cua mot vong, tinh bang BTCB.
 *
 * Ca hai huong deu bat dau va ket thuc bang BTCB, nen loi nhuan la hieu so
 * truc tiep. `quotedOutWei` la ket qua tu Quoter (staticcall), khong phai uoc luong.
 */
export function netProfitWei(args: {
  direction: Exclude<Direction, "none">;
  amountInWei: bigint;
  /** Dau ra cua chan swap, lay tu Quoter. */
  quotedOutWei: bigint;
  fees: Fees;
  gasCostWei: bigint;
}): bigint {
  const { direction, amountInWei, quotedOutWei, fees, gasCostWei } = args;
  // mint -> ban: quotedOutWei da la BTCB nhan ve tu pool.
  // mua -> redeem: quotedOutWei la BTCx nhan tu pool, con phai tru phi redeem.
  const grossOut =
    direction === "mint_vault_sell_pool" ? quotedOutWei : applyFeeBps(quotedOutWei, fees.redeemFeeBps);
  return grossOut - amountInWei - gasCostWei;
}

/** So BTCx nhan duoc khi nap `amountInWei` BTCB vao vault. */
export function mintOutWei(amountInWei: bigint, fees: Fees): bigint {
  return applyFeeBps(amountInWei, fees.mintFeeBps);
}

/** Gioi han quy mo lenh theo so du, tran cau hinh va tran an toan tuyet doi. */
export function clampNotional(args: {
  desiredWei: bigint;
  balanceWei: bigint;
  maxPerTradeWei: bigint;
}): bigint {
  const { desiredWei, balanceWei, maxPerTradeWei } = args;
  let n = desiredWei;
  if (n > balanceWei) n = balanceWei;
  if (n > maxPerTradeWei) n = maxPerTradeWei;
  return n > 0n ? n : 0n;
}

/**
 * Gioi han toc do. Tra ve true khi duoc phep giao dich tiep.
 *
 * Khong chi de bao ve von: no la rao chan khien bot nay khong dung duoc de bom
 * volume gia. Mot bot tao vol can giao dich lien tuc bat ke gia; cai nay tu
 * tat khi so lenh trong gio vuot han muc.
 */
export function withinRateLimit(recentTimestampsMs: number[], maxPerHour: number, nowMs: number): boolean {
  const cutoff = nowMs - 3_600_000;
  return recentTimestampsMs.filter((t) => t > cutoff).length < maxPerHour;
}

/** amountOutMinimum cho swap, tu bao gia va dung sai truot gia. */
export function minOutWithSlippage(quotedOutWei: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 1000) throw new RangeError("slippageBps ngoai khoang 0..1000");
  return applyFeeBps(quotedOutWei, slippageBps);
}
