import { run, ethers, network } from "hardhat";
import { chainConfig, PRICE_MAX_STALENESS } from "./config";
import { loadDeployment } from "./io";

/**
 * Verify source code tren BscScan. Bat buoc: token chua verify thi khong duoc
 * CoinGecko/CMC/OKX/Trust Wallet duyet, va nguoi dung khong co cach nao kiem chung.
 */
async function verify(address: string, constructorArguments: unknown[], label: string) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`  OK   ${label} ${address}`);
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/already verified/i.test(msg)) console.log(`  OK   ${label} ${address} (da verify tu truoc)`);
    else console.log(` FAIL  ${label} ${address}\n       ${msg.split("\n")[0]}`);
  }
}

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);

  if (!process.env.BSCSCAN_API_KEY) throw new Error("Thieu BSCSCAN_API_KEY trong .env");

  console.log(`\nVerify tren ${cfg.name} (${network.name})\n`);

  const vault = await ethers.getContractAt("BitcoinXVault", d.vault);
  await verify(d.vault, [d.collateral, await vault.feeRecipient(), await vault.owner()], "BitcoinXVault");
  // BitcoinX duoc vault tao ra, tham so constructor la chinh dia chi vault.
  await verify(d.btcx, [d.vault], "BitcoinX     ");

  if (d.lens && d.pool) {
    await verify(d.lens, [cfg.btcUsdFeed, d.pool, d.vault, PRICE_MAX_STALENESS], "BTCxPriceLens");
  }

  console.log(`\nXong. Kiem tra: ${cfg.explorer}/token/${d.btcx}#code\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
