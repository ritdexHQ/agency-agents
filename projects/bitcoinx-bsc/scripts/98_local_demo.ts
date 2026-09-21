import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";
import { saveDeployment } from "./io";

/**
 * Dung mot ban sao day du he thong tren node Hardhat cuc bo: vault, token, pool
 * gia lap, quoter va router. Muc dich:
 *
 *   1. Xem truoc trang web voi so lieu on-chain THAT, khong ton gas.
 *   2. Smoke test bot giu neo — ca nhanh mo phong lan nhanh gui lenh that.
 *
 *   npx hardhat node                      # cua so 1
 *   npm run demo:local                    # cua so 2
 *   npm run keeper:local                  # bot o che do mo phong
 *   KEEPER_EXECUTE=1 npm run keeper:local # bot gui lenh that tren chain cuc bo
 *
 * Chi danh cho phat trien. Pool o day dung tich so khong doi, khong phai ban
 * sao PancakeSwap V3 — no du de kiem chung huong arbitrage va viec chon quy mo.
 *
 * DEMO_SKEW_BPS dat gia pool lech khoi 1:1 de bot co viec de lam.
 */
async function main() {
  const [deployer, alice] = await ethers.getSigners();
  const skewBps = BigInt(process.env.DEMO_SKEW_BPS || 80);

  const btcb = await (await ethers.getContractFactory("MockERC20")).deploy("BTCB Token", "BTCB", 18);
  await btcb.waitForDeployment();

  const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
    await btcb.getAddress(),
    deployer.address,
    deployer.address,
  );
  await vault.waitForDeployment();
  const btcx = await ethers.getContractAt("BitcoinX", await vault.btcx());

  const btcbAddr = await btcb.getAddress();
  const btcxAddr = await btcx.getAddress();

  // --- Ha tang DEX gia lap ---
  const pool = await (await ethers.getContractFactory("MockCpmmPool")).deploy(btcxAddr, btcbAddr, 100);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  const quoter = await (await ethers.getContractFactory("MockQuoterV2")).deploy(poolAddr, poolAddr);
  const router = await (await ethers.getContractFactory("MockSwapRouter")).deploy(poolAddr);
  await Promise.all([quoter.waitForDeployment(), router.waitForDeployment()]);

  // --- Nap thanh khoan, co y lech khoi 1:1 ---
  // Du tru BTCB nhieu hon BTCx => 1 BTCx doi duoc nhieu BTCB hon 1 => BTCx dat hon BTC.
  // DEMO_POOL_BTCX cho phep thu cac quy mo pool khac nhau — kinh te cua bot giu
  // neo phu thuoc manh vao do sau pool so voi gas.
  const poolBtcx = ethers.parseUnits(process.env.DEMO_POOL_BTCX || "0.001078", 18);
  const poolBtcb = poolBtcx + (poolBtcx * skewBps) / 10_000n;

  await (await btcb.mint(deployer.address, poolBtcx * 20n + ethers.parseUnits("1", 18))).wait();
  await (await btcb.approve(await vault.getAddress(), ethers.MaxUint256)).wait();
  await (await vault.mint(poolBtcx, deployer.address)).wait();
  await (await btcx.transfer(poolAddr, poolBtcx)).wait();
  await (await btcb.transfer(poolAddr, poolBtcb)).wait();

  // --- Von cho bot giu neo. `hardhat run` dung signer dau tien, tuc deployer. ---
  await (await btcb.mint(deployer.address, ethers.parseUnits("0.01", 18))).wait();

  // --- Mot nguoi dung thuong, de bang chung du tru co so lieu ---
  const userAmount = ethers.parseUnits("0.002156", 18);
  await (await btcb.mint(alice.address, userAmount)).wait();
  await (await btcb.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256)).wait();
  await (await vault.connect(alice).mint(userAmount, alice.address)).wait();

  // --- Ghi cau hinh cho cac script khac ---
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "31337.infra.json"),
    JSON.stringify(
      {
        name: "Hardhat (local demo)",
        collateral: btcbAddr,
        collateralSymbol: "BTCB",
        btcUsdFeed: ethers.ZeroAddress,
        v3Factory: poolAddr,
        v3PositionManager: poolAddr,
        v3SwapRouter: await router.getAddress(),
        v3Quoter: await quoter.getAddress(),
        poolFee: 100,
        explorer: "https://bscscan.com",
      },
      null,
      2,
    ) + "\n",
  );

  saveDeployment({
    chainId: 31337,
    network: "localhost",
    deployer: deployer.address,
    collateral: btcbAddr,
    vault: await vault.getAddress(),
    btcx: btcxAddr,
    pool: poolAddr,
    deployedAt: new Date().toISOString(),
  });

  const webCfg = {
    chainId: 31337,
    chainName: "Hardhat (local demo)",
    explorer: "https://bscscan.com",
    btcx: btcxAddr,
    vault: await vault.getAddress(),
    collateral: btcbAddr,
    collateralSymbol: "BTCB",
    pool: poolAddr,
    lens: null,
    rpcs: ["http://127.0.0.1:8545"],
    links: { github: "https://github.com/example/bitcoinx", dexscreener: null, pancakeswap: null },
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "web", "config.local.js"),
    "window.BITCOINX_CONFIG = " + JSON.stringify(webCfg, null, 2) + ";\n",
  );

  console.log(`\nBTCB    ${btcbAddr}`);
  console.log(`Vault   ${await vault.getAddress()}`);
  console.log(`BTCx    ${btcxAddr}`);
  console.log(`Pool    ${poolAddr}`);
  console.log(`Router  ${await router.getAddress()}`);
  console.log(`Quoter  ${await quoter.getAddress()}`);
  console.log(`\nKhoa trong vault : ${ethers.formatUnits(await btcb.balanceOf(await vault.getAddress()), 18)} BTCB`);
  console.log(`BTCx luu hanh    : ${ethers.formatUnits(await btcx.totalSupply(), 18)}`);
  console.log(`Bao chung        : ${(Number(await vault.backingRatio()) / 1e16).toFixed(2)}%`);
  console.log(`Du tru pool      : ${ethers.formatUnits(await pool.reserve0(), 18)} / ${ethers.formatUnits(await pool.reserve1(), 18)}`);
  console.log(`Lech gia co y    : ${skewBps} bps`);
  console.log(`\nVi bot giu neo   : ${deployer.address}`);
  console.log(`  BTCB ${ethers.formatUnits(await btcb.balanceOf(deployer.address), 18)}`);
  console.log(`\nTiep theo: npm run keeper:local   (mo phong)`);
  console.log(`           mo web/index.html?local=1\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
