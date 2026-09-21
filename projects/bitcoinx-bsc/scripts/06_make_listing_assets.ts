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

  const local = Number(chainId) === 31337 ? ".local" : "";
  const write = (name: string, data: unknown) => {
    const p = path.join(outDir, name.replace(/(\.[^.]+)$/, `${local}$1`));
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
    console.log(`  ${p}`);
  };

  console.log(`\nSinh ho so listing cho ${address} tren ${cfg.name}:`);
  write("bitcoinx.tokenlist.json", tokenlist);
  write("trustwallet-info.json", trustwallet);
  write("submission.json", submission);

  // --- 4. Cau hinh cho trang web (web/index.html doc file nay) ---
  const webConfig = {
    chainId: Number(chainId),
    chainName: cfg.name,
    explorer: cfg.explorer,
    btcx: address,
    vault,
    collateral: ethers.getAddress(d.collateral),
    collateralSymbol: cfg.collateralSymbol,
    pool: d.pool ? ethers.getAddress(d.pool) : null,
    lens: d.lens ? ethers.getAddress(d.lens) : null,
    rpcs:
      Number(chainId) === 56
        ? [
            "https://bsc-dataseed.bnbchain.org",
            "https://bsc-dataseed1.defibit.io",
            "https://bsc-dataseed1.ninicoin.io",
            "https://rpc.ankr.com/bsc",
          ]
        : ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
    links: {
      github: process.env.GITHUB_URL || "https://github.com/example/bitcoinx",
      dexscreener: d.pool ? `https://dexscreener.com/bsc/${d.pool}` : null,
      pancakeswap: `https://pancakeswap.finance/swap?inputCurrency=${d.collateral}&outputCurrency=${address}`,
    },
  };
  // --- 4b. Phieu dien san cho DEX Screener Enhanced Token Info ---
  // Sinh tu dia chi that de khong ai phai go tay dia chi hop dong vao form tra phi.
  const dsSheet = `# DEX Screener — Enhanced Token Info

Sinh tu dia chi da deploy. **Khong sua tay** — chay lai \`npm run assets:mainnet\`.

Mua tai: https://marketplace.dexscreener.com/product/token-info

> Dieu kien tien quyet: cap phai DA DUOC INDEX. Chay \`npm run ds:mainnet\` va
> thay \`DA DUOC INDEX\` roi moi tra tien — goi nay gan thong tin vao mot trang
> cap dang ton tai.

## Cac o can dien

| O | Gia tri |
|---|---|
| Chain | ${cfg.name} (chainId ${chainId}) |
| Token address | \`${address}\` |
| Pair address | ${d.pool ? `\`${ethers.getAddress(d.pool)}\`` : "chua co pool — chay npm run pool:mainnet"} |
| Icon | \`brand/btcx-256.png\` (256x256) |
| Header / banner | \`brand/btcx-banner-600x200.png\` (ty le 3:1) |
| Website | ${site} |
| Explorer | ${cfg.explorer}/token/${address} |

## Mo ta — copy nguyen van

BitcoinX (BTCx) is a BEP-20 token on BNB Smart Chain backed 1:1 by BTCB
(Binance-Peg Bitcoin). Anyone can deposit BTCB to mint BTCx, or return BTCx to
withdraw BTCB, at exactly 1:1 and permissionlessly, through the BitcoinXVault
contract at ${vault}.

BTCx is NOT Bitcoin. It is a wrapper certificate for BTCB, redeemable 1:1 at any
time. Its price tracks Bitcoin because that redemption is always open to
everyone, not because any oracle sets a price.

The vault has no owner mint function, no blacklist and no transfer tax. Redeem
has no pause path in the bytecode, and fees are hard-capped at 0.50%. Source is
verified on BscScan and the reserve is publicly readable on-chain.

## Social — dien it nhat mot kenh CO NGUOI TRA LOI

- [ ] Telegram / Discord
- [ ] X (Twitter)
- [ ] GitHub: ${process.env.GITHUB_URL || "https://github.com/example/bitcoinx"}

## Nhac truoc khi bam thanh toan

- [ ] Chon goi **$299**, khong phai goi $499 (vuot ngan sach $500 sau gas + thanh khoan)
- [ ] O mo ta co cau "BTCx is NOT Bitcoin" — day la thu giu ho so khong bi doc thanh mao danh
- [ ] Website da song va hien dung so du tru
- [ ] \`npm run ds:mainnet\` bao DA DUOC INDEX

Sau khi tra tien: \`npm run ds:mainnet\` in trang thai don (processing / approved / rejected).
`;
  const dsPath = path.join(outDir, `dexscreener-submission${local}.md`);
  fs.writeFileSync(dsPath, dsSheet);
  console.log(`  ${dsPath}`);

  // Chain cuc bo ghi sang config.local.js. Neu khong, mot lan chay thu se de dia
  // chi Hardhat vao cau hinh that cua website va rat de bi commit nham.
  const isLocal = Number(chainId) === 31337;
  const webPath = path.join(__dirname, "..", "web", isLocal ? "config.local.js" : "config.js");
  fs.writeFileSync(
    webPath,
    "// SINH TU DONG boi scripts/06_make_listing_assets.ts — dung sua tay.\n" +
      "window.BITCOINX_CONFIG = " +
      JSON.stringify(webConfig, null, 2) +
      ";\n",
  );
  console.log(`  ${webPath}`);

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
