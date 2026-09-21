/**
 * Cau hinh trang web BitcoinX.
 *
 * File nay duoc SINH TU DONG boi `npm run assets:mainnet` tu dia chi da deploy
 * that (deployments/<chainId>.json). Dung sua tay — chay lai script de tranh
 * go nham mot ky tu trong dia chi hop dong.
 */
window.BITCOINX_CONFIG = {
  chainId: 56,
  chainName: "BNB Smart Chain",
  explorer: "https://bscscan.com",

  // Dien tu dong sau khi deploy. Khi con la null, trang hien trang thai
  // "chua trien khai" thay vi bao loi.
  btcx: null,
  vault: null,
  collateral: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", // BTCB
  collateralSymbol: "BTCB",
  pool: null,
  lens: null,

  // RPC cong cong, thu lan luot cho den khi co endpoint tra loi.
  rpcs: [
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc-dataseed1.defibit.io",
    "https://bsc-dataseed1.ninicoin.io",
    "https://rpc.ankr.com/bsc",
  ],

  links: {
    github: "https://github.com/example/bitcoinx",
    dexscreener: null,
    pancakeswap: null,
  },
};
