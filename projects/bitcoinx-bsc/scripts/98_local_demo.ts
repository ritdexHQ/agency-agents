import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

/**
 * Dung mot ban sao he thong tren node Hardhat cuc bo va sinh `web/config.local.js`,
 * de xem truoc trang web voi so lieu on-chain THAT ma khong ton mot dong gas nao.
 *
 *   npx hardhat node                 # cua so 1
 *   npm run demo:local               # cua so 2
 *   # mo web/index.html?local=1
 *
 * Chi danh cho phat trien. Khong dung o mainnet.
 */
async function main() {
  const [deployer, alice] = await ethers.getSigners();

  const btcb = await (await ethers.getContractFactory("MockERC20")).deploy("BTCB Token", "BTCB", 18);
  await btcb.waitForDeployment();

  const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
    await btcb.getAddress(),
    deployer.address,
    deployer.address,
  );
  await vault.waitForDeployment();
  const btcx = await ethers.getContractAt("BitcoinX", await vault.btcx());

  // Mo phong mot luong bao chung giong that: ~0.002156 BTCB nhu ke hoach ngan sach $200.
  const amount = ethers.parseUnits("0.002156", 18);
  await (await btcb.mint(alice.address, amount)).wait();
  await (await btcb.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256)).wait();
  await (await vault.connect(alice).mint(amount, alice.address)).wait();

  const cfg = {
    chainId: 31337,
    chainName: "Hardhat (local demo)",
    explorer: "https://bscscan.com",
    btcx: await btcx.getAddress(),
    vault: await vault.getAddress(),
    collateral: await btcb.getAddress(),
    collateralSymbol: "BTCB",
    pool: null,
    lens: null,
    rpcs: ["http://127.0.0.1:8545"],
    links: { github: "https://github.com/example/bitcoinx", dexscreener: null, pancakeswap: null },
  };

  const out = path.join(__dirname, "..", "web", "config.local.js");
  fs.writeFileSync(out, "window.BITCOINX_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n");

  console.log(`\nBTCB   ${cfg.collateral}`);
  console.log(`Vault  ${cfg.vault}`);
  console.log(`BTCx   ${cfg.btcx}`);
  console.log(`Khoa   ${ethers.formatUnits(await btcb.balanceOf(cfg.vault), 18)} BTCB`);
  console.log(`Phat   ${ethers.formatUnits(await btcx.totalSupply(), 18)} BTCx`);
  console.log(`Bao chung ${(Number(await vault.backingRatio()) / 1e16).toFixed(2)}%`);
  console.log(`\nDa ghi ${out}. Mo web/index.html?local=1\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
