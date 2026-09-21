import { expect } from "chai";
import {
  WAD,
  applyFeeBps,
  deviationBps,
  breakEvenBps,
  decide,
  netProfitWei,
  mintOutWei,
  clampNotional,
  withinRateLimit,
  minOutWithSlippage,
  ratioFromSqrtPrice,
  type Fees,
} from "../scripts/keeper/strategy";

const FEES: Fees = { poolFeeBps: 1, mintFeeBps: 0, redeemFeeBps: 0 }; // pool 0,01%
const ONE = WAD;
const ratio = (bps: number) => ONE + (ONE * BigInt(bps)) / 10_000n;

const base = {
  fees: FEES,
  minEdgeBps: 5,
  gasCostWei: 0n,
  notionalWei: ONE,
  mintPaused: false,
  backingRatio1e18: ONE,
};

describe("keeper — do luong do lech", () => {
  it("quy do lech ra bps, co dau", () => {
    expect(deviationBps(ONE)).to.equal(0);
    expect(deviationBps(ratio(250))).to.equal(250);
    expect(deviationBps(ratio(-120))).to.equal(-120);
  });

  it("tru phi luon lam tron xuong, khong bao gio tao ra tien", () => {
    expect(applyFeeBps(10_000n, 50)).to.equal(9_950n);
    expect(applyFeeBps(1n, 50)).to.equal(1n); // 1*50/10000 = 0 sau lam tron
    expect(applyFeeBps(0n, 50)).to.equal(0n);
    expect(() => applyFeeBps(100n, -1)).to.throw(RangeError);
  });
});

describe("keeper — nguong hoa von", () => {
  it("cong phi pool va phi vault theo dung huong", () => {
    const fees: Fees = { poolFeeBps: 1, mintFeeBps: 20, redeemFeeBps: 40 };
    expect(breakEvenBps(fees, "mint_vault_sell_pool", 0n, ONE)).to.equal(21);
    expect(breakEvenBps(fees, "buy_pool_redeem_vault", 0n, ONE)).to.equal(41);
  });

  it("gas duoc qui ra bps theo quy mo lenh — lenh cang nho nguong cang cao", () => {
    const gas = ONE / 1000n; // gas bang 0,1% quy mo tham chieu
    expect(breakEvenBps(FEES, "mint_vault_sell_pool", gas, ONE)).to.equal(1 + 10);
    expect(breakEvenBps(FEES, "mint_vault_sell_pool", gas, ONE / 10n)).to.equal(1 + 100);
    expect(breakEvenBps(FEES, "mint_vault_sell_pool", gas, 0n)).to.equal(Number.POSITIVE_INFINITY);
  });
});

describe("keeper — quyet dinh giao dich", () => {
  it("dung yen khi gia dung neo", () => {
    const d = decide({ ...base, ratio1e18: ONE });
    expect(d.direction).to.equal("none");
    expect(d.edgeBps).to.be.lessThan(base.minEdgeBps);
  });

  it("BTCx dat hon BTC -> mint tai vault roi ban tren pool", () => {
    const d = decide({ ...base, ratio1e18: ratio(60) });
    expect(d.direction).to.equal("mint_vault_sell_pool");
    expect(d.deviationBps).to.equal(60);
    expect(d.edgeBps).to.be.greaterThan(base.minEdgeBps);
  });

  it("BTCx re hon BTC -> mua tren pool roi redeem tai vault", () => {
    const d = decide({ ...base, ratio1e18: ratio(-60) });
    expect(d.direction).to.equal("buy_pool_redeem_vault");
    expect(d.deviationBps).to.equal(-60);
  });

  it("KHONG giao dich khi bien mong hon nguong — day la rao chan chong bom volume", () => {
    // Lech 3 bps, phi pool 1 bps -> bien 2 bps < nguong 5 bps.
    const d = decide({ ...base, ratio1e18: ratio(3) });
    expect(d.direction).to.equal("none");
    expect(d.reason).to.contain("nguong");
  });

  it("gas lam bien am thi khong giao dich, du gia lech nhieu", () => {
    // Lech 60 bps nhung gas bang 1% quy mo lenh -> hoa von 101 bps.
    const d = decide({ ...base, ratio1e18: ratio(60), gasCostWei: ONE / 100n });
    expect(d.direction).to.equal("none");
    expect(d.edgeBps).to.be.lessThan(0);
  });

  it("dung het khi vault thieu bao chung", () => {
    const d = decide({ ...base, ratio1e18: ratio(300), backingRatio1e18: ONE - 1n });
    expect(d.direction).to.equal("none");
    expect(d.reason).to.contain("bao chung");
  });

  it("khong mint khi vault dang tam dung mint, nhung van redeem duoc", () => {
    expect(decide({ ...base, ratio1e18: ratio(60), mintPaused: true }).direction).to.equal("none");
    expect(decide({ ...base, ratio1e18: ratio(-60), mintPaused: true }).direction).to.equal(
      "buy_pool_redeem_vault",
    );
  });

  it("tu choi gia pool khong hop le va quy mo bang khong", () => {
    expect(decide({ ...base, ratio1e18: 0n }).direction).to.equal("none");
    expect(decide({ ...base, ratio1e18: ratio(300), notionalWei: 0n }).direction).to.equal("none");
  });
});

describe("keeper — loi nhuan rong", () => {
  it("huong mint->ban: lai bang dau ra tru dau vao tru gas", () => {
    const p = netProfitWei({
      direction: "mint_vault_sell_pool",
      amountInWei: ONE,
      quotedOutWei: (ONE * 10_050n) / 10_000n, // pool tra ve 1,005 BTCB
      fees: FEES,
      gasCostWei: ONE / 10_000n,
    });
    expect(p).to.equal((ONE * 10_050n) / 10_000n - ONE - ONE / 10_000n);
    expect(p).to.be.greaterThan(0n);
  });

  it("huong mua->redeem: phi redeem bi tru vao dau ra truoc khi tinh lai", () => {
    const fees: Fees = { poolFeeBps: 1, mintFeeBps: 0, redeemFeeBps: 50 };
    const quoted = (ONE * 10_100n) / 10_000n; // nhan 1,01 BTCx
    const p = netProfitWei({
      direction: "buy_pool_redeem_vault",
      amountInWei: ONE,
      quotedOutWei: quoted,
      fees,
      gasCostWei: 0n,
    });
    expect(p).to.equal(applyFeeBps(quoted, 50) - ONE);
  });

  it("bao lo bang so am — bot dung so nay de tu choi lenh", () => {
    const p = netProfitWei({
      direction: "mint_vault_sell_pool",
      amountInWei: ONE,
      quotedOutWei: (ONE * 9_990n) / 10_000n,
      fees: FEES,
      gasCostWei: ONE / 1000n,
    });
    expect(p).to.be.lessThan(0n);
  });

  it("mintOutWei tru dung phi mint", () => {
    expect(mintOutWei(ONE, { ...FEES, mintFeeBps: 25 })).to.equal((ONE * 9_975n) / 10_000n);
  });
});

describe("keeper — gioi han an toan", () => {
  it("quy mo lenh bi chan boi so du va tran cau hinh", () => {
    expect(clampNotional({ desiredWei: 10n * ONE, balanceWei: 3n * ONE, maxPerTradeWei: 5n * ONE })).to.equal(3n * ONE);
    expect(clampNotional({ desiredWei: 10n * ONE, balanceWei: 8n * ONE, maxPerTradeWei: 5n * ONE })).to.equal(5n * ONE);
    expect(clampNotional({ desiredWei: 2n * ONE, balanceWei: 8n * ONE, maxPerTradeWei: 5n * ONE })).to.equal(2n * ONE);
    expect(clampNotional({ desiredWei: -1n, balanceWei: 8n * ONE, maxPerTradeWei: 5n * ONE })).to.equal(0n);
  });

  it("gioi han toc do chan chuoi lenh lien tuc trong mot gio", () => {
    const now = 1_700_000_000_000;
    const recent = [now - 1000, now - 2000, now - 3000];
    expect(withinRateLimit(recent, 4, now)).to.equal(true);
    expect(withinRateLimit(recent, 3, now)).to.equal(false);
    // Lenh cu hon mot gio khong tinh nua.
    expect(withinRateLimit([now - 3_600_001, now - 3_700_000], 1, now)).to.equal(true);
  });

  it("minOut theo dung sai truot gia, va tu choi dung sai vo ly", () => {
    expect(minOutWithSlippage(10_000n, 50)).to.equal(9_950n);
    expect(minOutWithSlippage(10_000n, 0)).to.equal(10_000n);
    expect(() => minOutWithSlippage(10_000n, 1001)).to.throw(RangeError);
    expect(() => minOutWithSlippage(10_000n, -1)).to.throw(RangeError);
  });
});

describe("keeper — doc gia tu pool V3", () => {
  const Q96 = 2n ** 96n;

  /** floor(sqrt(n)) cho BigInt. */
  const isqrt = (n: bigint): bigint => {
    if (n < 2n) return n;
    let x = n;
    let y = (x + 1n) / 2n;
    while (y < x) { x = y; y = (x + n / x) / 2n; }
    return x;
  };
  /** sqrtPriceX96 ung voi gia token1/token0 = num/den. */
  const sqrtP = (num: bigint, den: bigint) => isqrt((num * Q96 * Q96) / den);

  it("doc dung khi BTCx la token0", () => {
    expect(ratioFromSqrtPrice(sqrtP(1n, 1n), true)).to.be.closeTo(ONE, 10n ** 6n);
    expect(ratioFromSqrtPrice(sqrtP(105n, 100n), true)).to.be.closeTo((105n * ONE) / 100n, 10n ** 6n);
    expect(ratioFromSqrtPrice(sqrtP(97n, 100n), true)).to.be.closeTo((97n * ONE) / 100n, 10n ** 6n);
  });

  it("lay nghich dao khi BTCx la token1 — nham thu tu la arbitrage sai huong", () => {
    // Pool bao token1/token0 = BTCx tren BTCB. De 1 BTCx = 1,05 BTCB thi gia pool la 1/1,05.
    expect(ratioFromSqrtPrice(sqrtP(100n, 105n), false)).to.be.closeTo((105n * ONE) / 100n, 10n ** 7n);
    expect(ratioFromSqrtPrice(sqrtP(1n, 1n), false)).to.be.closeTo(ONE, 10n ** 6n);
  });

  it("hai thu tu cho ket qua nguoc dau nhau tren cung mot pool", () => {
    const p = sqrtP(102n, 100n);
    const asToken0 = ratioFromSqrtPrice(p, true);
    const asToken1 = ratioFromSqrtPrice(p, false);
    expect(deviationBps(asToken0)).to.be.greaterThan(0);
    expect(deviationBps(asToken1)).to.be.lessThan(0);
  });

  it("tra ve 0 khi gia khong hop le, thay vi con so vo nghia", () => {
    expect(ratioFromSqrtPrice(0n, true)).to.equal(0n);
    expect(ratioFromSqrtPrice(-1n, true)).to.equal(0n);
    expect(decide({ ...base, ratio1e18: ratioFromSqrtPrice(0n, true) }).direction).to.equal("none");
  });

  it("chiu duoc gia cuc doan ma khong tran so", () => {
    expect(ratioFromSqrtPrice(sqrtP(1n, 1_000_000n), true)).to.be.closeTo(ONE / 1_000_000n, 10n ** 6n);
    expect(ratioFromSqrtPrice(sqrtP(1_000_000n, 1n), true)).to.be.closeTo(1_000_000n * ONE, 10n ** 13n);
  });
});
