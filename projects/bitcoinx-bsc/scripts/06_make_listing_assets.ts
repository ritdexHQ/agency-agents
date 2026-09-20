import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";
import { chainConfig } from "./config";
import { loadDeployment } from "./io";

/**
 * Sinh cac file ho so listing tu dia chi DA DEPLOY THAT, thay vi go tay.
 * Mot ky tu sai trong dia chi = nguoi dung mua nham token khac.
 *
 * LOGO_BASE_URL nen tro toi noi ban host that (vi du GitHub Pages hoac
 * raw.githubusercontent.com cua repo cong khai cua ban).
 */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const cfg = chainConfig(chainId);
  const d = loadDeployment(chainId);
  const outDir = path.join(__dirname, "..", "tokenlist");
  fs.mkdirSync(outDir, { recursive: true });

  const address = ethers.getAddress(d.btcx); // checksum hoa
  const vault = ethers.getAddress(d.vault);
  const base = (process.env.LOGO_BASE_URL || "https://example.com/bitcoinx").replace(/\/$/, "");
  const site = process.env.PROJECT_URL || "https://example.com/bitcoinx";

  const description =
    "BitcoinX (BTCx) la token ERC20 tren BNB Smart Chain duoc bao chung 1:1 boi BTCB " +
    "(Binance-Peg Bitcoin). Bat ky ai cung co the nap BTCB de mint BTCx hoac tra BTCx de rut " +
    "BTCB theo ty le 1:1, khong can xin phep, thong qua BitcoinXVault. Co che doi 1:1 luon mo " +
    "nay la ly do gia BTCx bam theo gia Bitcoin.";

  // --- 1. Token list chuan Uniswap (PancakeSwap, MetaMask, Rabby deu doc duoc) ---
  const tokenlist = {
    name: "BitcoinX",
    timestamp: new Date().toISOString(),
    version: { major: 1, minor: 0, patch: 0 },
    logoURI: `${base}/btcx-256.png`,
    keywords: ["bitcoinx", "btcx", "bsc", "bitcoin", "wrapped"],
    tokens: [
      {
        chainId: Number(chainId),
        address,
        name: "BitcoinX",
        symbol: "BTCx",
        decimals: 18,
        logoURI: `${base}/btcx-256.png`,
      },
    ],
  };

  // --- 2. info.json theo dung schema cua trustwallet/assets ---
  const trustwallet = {
    name: "BitcoinX",
    website: site,
    description,
    explorer: `${cfg.explorer}/token/${address}`,
    type: "BEP20",
    symbol: "BTCx",
    decimals: 18,
    status: "active",
    id: address,
    links: [{ name: "github", url: process.env.GITHUB_URL || "https://github.com/example/bitcoinx" }],
  };

  // --- 3. Tham so san sang dan vao form dang ky ---
  const submission = {
    projectName: "BitcoinX",
    symbol: "BTCx",
    chain: cfg.name,
    chainId: Number(chainId),
    contractAddress: address,
    decimals: 18,
    vaultAddress: vault,
    collateralAddress: ethers.getAddress(d.collateral),
    pairPool: d.pool ? ethers.getAddress(d.pool) : null,
    priceLens: d.lens ? ethers.getAddress(d.lens) : null,
    explorerToken: `${cfg.explorer}/token/${address}`,
    explorerVault: `${cfg.explorer}/address/${vault}`,
    dexscreener: d.pool ? `https://dexscreener.com/bsc/${d.pool}` : null,
    logo256: `${base}/btcx-256.png`,
    logo200: `${base}/btcx-200.png`,
    logoSvg: `${base}/btcx-logo.svg`,
    website: site,
    description,
  };

  const write = (name: string, data: unknown) => {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
    console.log(`  ${p}`);
  };

  console.log(`\nSinh ho so listing cho ${address} tren ${cfg.name}:`);
  write("bitcoinx.tokenlist.json", tokenlist);
  write("trustwallet-info.json", trustwallet);
  write("submission.json", submission);

  if (base.includes("example.com")) {
    console.log(
      `\nCANH BAO: LOGO_BASE_URL/PROJECT_URL van la example.com. Dat lai trong .env ` +
        `va chay lai truoc khi nop bat ky ho so nao.`,
    );
  }
  console.log(`\nDanh sach noi can nop: docs/04-logo-va-gia-tren-vi.md\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
