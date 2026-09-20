import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;
const Q96 = 2n ** 96n;
const MAX_STALENESS = 3600n;

/** floor(sqrt(n)) cho BigInt — Newton. */
function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** sqrtPriceX96 ung voi gia token1/token0 = num/den. */
function sqrtPriceX96(num: bigint, den: bigint): bigint {
  return isqrt((num * Q96 * Q96) / den);
}

async function lensFixture() {
  const [owner, alice, feeRecipient] = await ethers.getSigners();

  const btcb = await (await ethers.getContractFactory("MockERC20")).deploy("Binance-Peg BTCB", "BTCB", 18);
  const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
    await btcb.getAddress(),
    feeRecipient.address,
    owner.address,
  );
  const btcx = await ethers.getContractAt("BitcoinX", await vault.btcx());

  // Chainlink BTC/USD tren BSC tra ve 8 decimals.
  const feed = await (await ethers.getContractFactory("MockAggregator")).deploy(8, 65_000n * 10n ** 8n);

  await btcb.mint(alice.address, 100n * ONE);
  await btcb.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
  await vault.connect(alice).mint(10n * ONE, alice.address);

  return { owner, alice, btcb, btcx, vault, feed };
}

async function deployLens(btcxFirst: boolean, num: bigint, den: bigint) {
  const base = await loadFixture(lensFixture);
  const btcxAddr = await base.btcx.getAddress();
  const btcbAddr = await base.btcb.getAddress();

  const [token0, token1] = btcxFirst ? [btcxAddr, btcbAddr] : [btcbAddr, btcxAddr];
  const pool = await (await ethers.getContractFactory("MockV3Pool")).deploy(token0, token1, sqrtPriceX96(num, den));
  const lens = await (await ethers.getContractFactory("BTCxPriceLens")).deploy(
    await base.feed.getAddress(),
    await pool.getAddress(),
    await base.vault.getAddress(),
    MAX_STALENESS,
  );
  return { ...base, pool, lens };
}

describe("BTCxPriceLens", () => {
  it("doc gia BTC/USD tu Chainlink va chuan hoa ve 1e18", async () => {
    const { lens } = await deployLens(true, 1n, 1n);

    const [price] = await lens.btcUsd();
    expect(price).to.equal(65_000n * ONE);
  });

  it("tinh ty gia BTCx/BTCB khi BTCx la token0", async () => {
    const { lens } = await deployLens(true, 1n, 1n);
    expect(await lens.btcxPerBtcb()).to.be.closeTo(ONE, 10n ** 6n);

    const { lens: lensHigh } = await deployLens(true, 105n, 100n);
    expect(await lensHigh.btcxPerBtcb()).to.be.closeTo((105n * ONE) / 100n, 10n ** 6n);
  });

  it("tinh dung ca khi BTCx la token1 (lay nghich dao)", async () => {
    // Pool bao gia token1/token0 = BTCx tren BTCB. De 1 BTCx = 1.05 BTCB thi
    // gia pool phai la 1/1.05.
    const { lens } = await deployLens(false, 100n, 105n);
    expect(await lens.btcxPerBtcb()).to.be.closeTo((105n * ONE) / 100n, 10n ** 6n);

    const { lens: lensPeg } = await deployLens(false, 1n, 1n);
    expect(await lensPeg.btcxPerBtcb()).to.be.closeTo(ONE, 10n ** 6n);
  });

  it("snapshot() gom du gia, do lech neo va do bao chung", async () => {
    const { lens } = await deployLens(true, 1n, 1n);

    const s = await lens.snapshot();
    expect(s.btcUsd1e18).to.equal(65_000n * ONE);
    expect(s.btcxUsd1e18).to.be.closeTo(65_000n * ONE, 10n ** 12n);
    expect(s.backingRatio1e18).to.equal(ONE);
    expect(s.pegDeviationBps).to.equal(0n);
  });

  it("bao do lech neo theo bps khi gia pool troi khoi 1:1", async () => {
    const { lens } = await deployLens(true, 102n, 100n);

    const s = await lens.snapshot();
    // sai so 1 bps den tu lam tron sqrt khi dung gia pool trong test, khong phai tu hop dong.
    expect(s.pegDeviationBps).to.be.closeTo(200n, 1n); // BTCx dat hon BTC ~2%
    expect(s.btcxUsd1e18).to.be.closeTo((65_000n * ONE * 102n) / 100n, 10n ** 14n);

    const { lens: lensLow } = await deployLens(true, 97n, 100n);
    expect((await lensLow.snapshot()).pegDeviationBps).to.be.closeTo(-300n, 1n);
  });

  it("tu choi gia Chainlink qua cu", async () => {
    const { lens, feed } = await deployLens(true, 1n, 1n);

    const now = await time.latest();
    await feed.setAnswer(65_000n * 10n ** 8n, BigInt(now) - MAX_STALENESS - 60n);
    await expect(lens.btcUsd()).to.be.revertedWithCustomError(lens, "StalePrice");
    await expect(lens.snapshot()).to.be.revertedWithCustomError(lens, "StalePrice");
  });

  it("tu choi gia Chainlink khong hop le", async () => {
    const { lens, feed } = await deployLens(true, 1n, 1n);

    await feed.setAnswer(0n, BigInt(await time.latest()));
    await expect(lens.btcUsd()).to.be.revertedWithCustomError(lens, "InvalidPrice");

    await feed.setAnswer(-1n, BigInt(await time.latest()));
    await expect(lens.btcUsd()).to.be.revertedWithCustomError(lens, "InvalidPrice");
  });

  it("tu choi deploy neu pool khong phai cap BTCx/collateral", async () => {
    const base = await loadFixture(lensFixture);
    const junk = await (await ethers.getContractFactory("MockERC20")).deploy("Junk", "JNK", 18);
    const badPool = await (await ethers.getContractFactory("MockV3Pool")).deploy(
      await junk.getAddress(),
      await base.btcb.getAddress(),
      Q96,
    );
    const factory = await ethers.getContractFactory("BTCxPriceLens");

    await expect(
      factory.deploy(
        await base.feed.getAddress(),
        await badPool.getAddress(),
        await base.vault.getAddress(),
        MAX_STALENESS,
      ),
    ).to.be.revertedWithCustomError(factory, "PoolTokenMismatch");
  });

  it("chiu duoc gia pool cuc doan ma khong tran so", async () => {
    const { lens } = await deployLens(true, 1n, 1_000_000n);
    expect(await lens.btcxPerBtcb()).to.be.closeTo(ONE / 1_000_000n, 10n ** 6n);

    const { lens: lensHuge } = await deployLens(true, 1_000_000n, 1n);
    expect(await lensHuge.btcxPerBtcb()).to.be.closeTo(1_000_000n * ONE, 10n ** 13n);
  });
});
