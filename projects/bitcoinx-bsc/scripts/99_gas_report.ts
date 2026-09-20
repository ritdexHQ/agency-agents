import { ethers } from "hardhat";

async function main() {
  const [owner, alice] = await ethers.getSigners();
  const btcb = await (await ethers.getContractFactory("MockERC20")).deploy("BTCB", "BTCB", 18);
  const vaultTx = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
    await btcb.getAddress(), owner.address, owner.address,
  );
  const r = await vaultTx.deploymentTransaction()!.wait();
  console.log("deploy vault+token gas :", r!.gasUsed.toString());

  const vault = vaultTx;
  const btcx = await ethers.getContractAt("BitcoinX", await vault.btcx());
  await btcb.mint(alice.address, 10n ** 20n);
  const ap = await (await btcb.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256)).wait();
  console.log("approve gas            :", ap!.gasUsed.toString());
  const m1 = await (await vault.connect(alice).mint(10n ** 18n, alice.address)).wait();
  console.log("mint gas (lan dau)     :", m1!.gasUsed.toString());
  const m2 = await (await vault.connect(alice).mint(10n ** 18n, alice.address)).wait();
  console.log("mint gas (lan sau)     :", m2!.gasUsed.toString());
  const rd = await (await vault.connect(alice).redeem(10n ** 18n, alice.address)).wait();
  console.log("redeem gas             :", rd!.gasUsed.toString());
  const tr = await (await btcx.connect(alice).transfer(owner.address, 1n)).wait();
  console.log("transfer BTCx gas      :", tr!.gasUsed.toString());

  const pool = await (await ethers.getContractFactory("MockV3Pool")).deploy(
    await btcx.getAddress(), await btcb.getAddress(), 2n ** 96n);
  const feed = await (await ethers.getContractFactory("MockAggregator")).deploy(8, 8117814000000n);
  const lens = await (await ethers.getContractFactory("BTCxPriceLens")).deploy(
    await feed.getAddress(), await pool.getAddress(), await vault.getAddress(), 3600);
  const lr = await lens.deploymentTransaction()!.wait();
  console.log("deploy lens gas        :", lr!.gasUsed.toString());

  const codeSize = (addr: string) => ethers.provider.getCode(addr).then((c) => (c.length - 2) / 2);
  console.log("bytecode vault (bytes) :", await codeSize(await vault.getAddress()));
  console.log("bytecode btcx  (bytes) :", await codeSize(await btcx.getAddress()));
  console.log("bytecode lens  (bytes) :", await codeSize(await lens.getAddress()));
}
main().catch((e) => { console.error(e); process.exit(1); });
