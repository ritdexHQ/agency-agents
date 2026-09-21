import { ethers, network } from "hardhat";
import { chainConfig } from "./config";
import { saveDeployment } from "./io";

/**
 * Deploy BitcoinXVault. Vault TU TAO token BitcoinX trong constructor cua no,
 * nen `BitcoinX.vault` la immutable va tro dung vault nay ngay tu block dau tien.
 * Khong ton tai giai doan nao ma quyen mint nam ngoai vault.
 */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const [deployer] = await ethers.getSigners();

  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\nMang       : ${cfg.name} (${network.name}, chainId ${chainId})`);
  console.log(`Deployer   : ${deployer.address}`);
  console.log(`So du      : ${ethers.formatEther(balance)} BNB`);
  console.log(`Collateral : ${cfg.collateral} (${cfg.collateralSymbol})`);
  console.log(`Fee to     : ${feeRecipient}\n`);

  if (balance === 0n) throw new Error("Vi deployer khong co BNB de tra gas.");

  const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
    cfg.collateral,
    feeRecipient,
    deployer.address,
  );
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  const btcxAddress = await vault.btcx();
  const btcx = await ethers.getContractAt("BitcoinX", btcxAddress);

  // --- Kiem tra sau deploy. Sai bat ky muc nao thi khong dung contract nay. ---
  const checks: Array<[string, boolean, string]> = [
    ["btcx.vault() == vault", (await btcx.vault()).toLowerCase() === vaultAddress.toLowerCase(), await btcx.vault()],
    ["name", (await btcx.name()) === "BitcoinX", await btcx.name()],
    ["symbol", (await btcx.symbol()) === "BTCx", await btcx.symbol()],
    ["decimals", (await btcx.decimals()) === 18n, String(await btcx.decimals())],
    ["totalSupply == 0", (await btcx.totalSupply()) === 0n, String(await btcx.totalSupply())],
    ["vault.collateral()", (await vault.collateral()).toLowerCase() === cfg.collateral.toLowerCase(), await vault.collateral()],
    ["mintFeeBps == 0", (await vault.mintFeeBps()) === 0n, String(await vault.mintFeeBps())],
    ["redeemFeeBps == 0", (await vault.redeemFeeBps()) === 0n, String(await vault.redeemFeeBps())],
    ["mintPaused == false", (await vault.mintPaused()) === false, String(await vault.mintPaused())],
  ];

  console.log("Kiem tra sau deploy:");
  let failed = 0;
  for (const [label, ok, detail] of checks) {
    console.log(`${ok ? "  OK  " : " FAIL "} ${label.padEnd(24)} ${detail}`);
    if (!ok) failed++;
  }
  if (failed > 0) throw new Error(`${failed} kiem tra that bai — KHONG dung contract nay.`);

  saveDeployment({
    chainId: Number(chainId),
    network: network.name,
    deployer: deployer.address,
    collateral: cfg.collateral,
    vault: vaultAddress,
    btcx: btcxAddress,
    deployedAt: new Date().toISOString(),
  });

  console.log(`\nBitcoinXVault : ${cfg.explorer}/address/${vaultAddress}`);
  console.log(`BitcoinX BTCx : ${cfg.explorer}/token/${btcxAddress}`);
  console.log(`\nBuoc tiep theo:`);
  console.log(`  1) npm run verify:${network.name === "bsc" ? "mainnet" : "testnet"}`);
  console.log(`  2) npm run pool:${network.name === "bsc" ? "mainnet" : "testnet"}   (tao pool + nap thanh khoan)`);
  console.log(`  3) npm run lens:${network.name === "bsc" ? "mainnet" : "testnet"}   (deploy BTCxPriceLens)`);
  console.log(`  4) Nop ho so logo/gia theo docs/04-logo-va-gia-tren-vi.md\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
