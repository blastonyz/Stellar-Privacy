import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@stellar/stellar-sdk";
import { config as loadEnv } from "dotenv";

/** Backend package root — same layout locally and on Cloud Run (/app). */
export const appRoot = path.resolve(import.meta.dirname, "..");

loadEnv({ path: path.join(appRoot, ".env") });
loadEnv({ path: path.join(appRoot, "..", ".env"), override: false });

function defaultVkBuildDir(): string {
  if (process.env.VK_BUILD_DIR) {
    return process.env.VK_BUILD_DIR;
  }
  const bundled = path.join(appRoot, "circuits", "build");
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  return path.resolve(appRoot, "..", "circuits", "build");
}

function resolveAdminPublicKey(): string {
  if (process.env.ADMIN_PUBLIC_KEY) {
    return process.env.ADMIN_PUBLIC_KEY;
  }
  const secret = process.env.SECRET_KEY;
  if (secret) {
    return Keypair.fromSecret(secret).publicKey();
  }
  return "";
}

export const config = {
  port: Number(process.env.PORT ?? "8080"),
  rpcUrl: process.env.RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  contractId: process.env.ENCRYPTED_TOKEN_CONTRACT_ID ?? "",
  vkBuildDir: defaultVkBuildDir(),
  txTimeoutSeconds: Number(process.env.TX_TIMEOUT_SECONDS ?? "1800"),
  rapidsnarkBin: process.env.RAPIDSNARK_BIN || undefined,
  adminPublicKey: resolveAdminPublicKey(),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  /** Demo: POST /tx/register-counterparty accepts a Stellar secret to sign register server-side. */
  allowCounterpartyRegister: process.env.ALLOW_COUNTERPARTY_REGISTER !== "false",
  /** Save BabyJub sk server-side when register proofs are built (testnet demo recovery). */
  persistRegisterState: process.env.PERSIST_REGISTER_STATE !== "false",
  registerStateDir: process.env.REGISTER_STATE_DIR ?? path.join(appRoot, "data", "register-states"),
  /** When set, view keys are stored in this GCS bucket (recommended on Cloud Run). */
  gcsRegisterStateBucket: process.env.GCS_REGISTER_STATE_BUCKET ?? "",
  gcsRegisterStatePrefix: process.env.GCS_REGISTER_STATE_PREFIX ?? "register-states",
};

export function assertContractConfigured(): void {
  if (!config.contractId) {
    throw new Error("Missing ENCRYPTED_TOKEN_CONTRACT_ID");
  }
}

export function circuitPath(...parts: string[]): string {
  return path.join(config.vkBuildDir, ...parts);
}
