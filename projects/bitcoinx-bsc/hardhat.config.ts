import { HardhatUserConfig, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const SOLC_VERSION = "0.8.24";

// Dung solc cai qua npm (node_modules/solc) thay vi tai binary tu
// binaries.soliditylang.org. Loi ich: build tai lap duoc, chay duoc trong CI
// hoac moi truong co egress allowlist. Neu khong co goi solc, Hardhat quay ve
// hanh vi mac dinh (tu tai compiler).
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }, _hre, runSuper) => {
  if (args.solcVersion === SOLC_VERSION) {
    try {
      const soljson = path.join(__dirname, "node_modules", "solc", "soljson.js");
      const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, "node_modules", "solc", "package.json"), "utf8"),
      );
      if (fs.existsSync(soljson) && String(pkg.version).startsWith(SOLC_VERSION)) {
        return {
          compilerPath: soljson,
          isSolcJs: true,
          version: args.solcVersion,
          longVersion: pkg.version,
        };
      }
    } catch {
      // bo qua, dung duong mac dinh
    }
  }
  return runSuper();
});

const PK = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = PK && /^0x[0-9a-fA-F]{64}$/.test(PK) ? [PK] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 1_000_000 },
      // BSC da bat Shanghai, nhung "paris" tranh PUSH0 -> an toan tuyet doi
      // voi moi node/explorer/bridge cu con chay tren BSC.
      evmVersion: "paris",
      metadata: { bytecodeHash: "none" },
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org",
      chainId: 56,
      accounts,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
  gasReporter: { enabled: false },
};

export default config;
