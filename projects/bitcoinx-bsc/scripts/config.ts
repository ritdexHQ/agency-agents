/**
 * Hang so theo tung mang.
 *
 * CANH BAO: dung tin file nay mot cach mu quang. Chay `npm run check:mainnet`
 * (scripts/00_check_addresses.ts) truoc khi deploy — script do doc on-chain va
 * doi chieu symbol/decimals/description that su cua tung dia chi.
 */

export interface ChainConfig {
  name: string;
  /** Tai san bao chung. Tren BSC la BTCB (Binance-Peg Bitcoin). */
  collateral: string;
  collateralSymbol: string;
  /** Chainlink BTC/USD — chi dung cho dashboard, KHONG dung de dinh gia mint/redeem. */
  btcUsdFeed: string;
  /** PancakeSwap V3. */
  v3Factory: string;
  v3PositionManager: string;
  v3SwapRouter: string;
  /** Phi pool. 100 = 0.01% — tang thich hop nhat cho cap gan nhu 1:1. */
  poolFee: number;
  explorer: string;
}

export const CHAINS: Record<number, ChainConfig> = {
  56: {
    name: "BNB Smart Chain",
    collateral: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", // BTCB, 18 decimals
    collateralSymbol: "BTCB",
    btcUsdFeed: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf", // Chainlink BTC/USD
    v3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    v3PositionManager: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    v3SwapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    poolFee: 100,
    explorer: "https://bscscan.com",
  },
  97: {
    name: "BNB Smart Chain Testnet",
    // Cac dia chi testnet doi thuong xuyen hon mainnet — BAT BUOC chay
    // `npm run check:testnet` de xac nhan truoc khi dung.
    collateral: "0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8",
    collateralSymbol: "BTCB",
    btcUsdFeed: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C",
    v3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    v3PositionManager: "0x427bF5b37357632377eCbEC9de3626C71A5396c1",
    v3SwapRouter: "0x9a489505a00cE272eAa5e07Dba6491314CaE3796",
    poolFee: 100,
    explorer: "https://testnet.bscscan.com",
  },
};

export function chainConfig(chainId: bigint | number): ChainConfig {
  const cfg = CHAINS[Number(chainId)];
  if (!cfg) throw new Error(`Chua cau hinh cho chainId ${chainId}. Bo sung vao scripts/config.ts.`);
  return cfg;
}

/** Chainlink BTC/USD tren BSC nhip 60s; 1 gio la nguong "cu" rat rong rai. */
export const PRICE_MAX_STALENESS = 3600;
