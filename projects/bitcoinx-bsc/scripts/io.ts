import * as fs from "fs";
import * as path from "path";

export interface Deployment {
  chainId: number;
  network: string;
  deployer: string;
  collateral: string;
  vault: string;
  btcx: string;
  lens?: string;
  pool?: string;
  positionTokenId?: string;
  deployedAt: string;
}

const dir = path.join(__dirname, "..", "deployments");

export function deploymentPath(chainId: bigint | number): string {
  return path.join(dir, `${Number(chainId)}.json`);
}

export function saveDeployment(d: Deployment): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(deploymentPath(d.chainId), JSON.stringify(d, null, 2) + "\n");
}

export function loadDeployment(chainId: bigint | number): Deployment {
  const p = deploymentPath(chainId);
  if (!fs.existsSync(p)) {
    throw new Error(`Khong tim thay ${p}. Chay scripts/01_deploy.ts truoc.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as Deployment;
}

export function updateDeployment(chainId: bigint | number, patch: Partial<Deployment>): Deployment {
  const merged = { ...loadDeployment(chainId), ...patch };
  saveDeployment(merged);
  return merged;
}
