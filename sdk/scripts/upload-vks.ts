import "./bootstrap-env.js";
import { fetchHorizonJson } from "./stellar-fetch.js";
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  scSymbol,
  scVec,
  type SnarkJsVerificationKey,
  verificationKeyToScVal,
} from "../src/bn254.js";
import { runScript } from "./tx-helpers.js";

type Operation = {
  opType: "Register" | "Mint" | "Transfer" | "Deposit" | "Withdraw";
  dirName: string;
};

const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
const projectRoot = path.resolve(__dirname, "../..");

loadEnv({ path: path.join(projectRoot, ".env") });
loadEnv({ path: path.join(projectRoot, "sdk", ".env"), override: false });

const OPERATIONS: Operation[] = [
  { opType: "Register", dirName: "register" },
  { opType: "Mint", dirName: "mint" },
  { opType: "Transfer", dirName: "transfer" },
  { opType: "Deposit", dirName: "deposit" },
  { opType: "Withdraw", dirName: "withdraw" },
];

const {
  RPC_URL = "https://soroban-testnet.stellar.org",
  HORIZON_URL = "https://horizon-testnet.stellar.org",
  NETWORK_PASSPHRASE = Networks.TESTNET,
  CONTRACT_ID,
  ENCRYPTED_TOKEN_CONTRACT_ID,
  SECRET_KEY,
  ADMIN_SECRET,
  VK_BUILD_DIR = path.join(projectRoot, "circuits", "build"),
  TX_TIMEOUT_SECONDS = "180",
} = process.env;

const SIGNING_SECRET = SECRET_KEY ?? ADMIN_SECRET;

const contractId = ENCRYPTED_TOKEN_CONTRACT_ID ?? CONTRACT_ID;

if (!contractId) {
  throw new Error("Missing CONTRACT_ID or ENCRYPTED_TOKEN_CONTRACT_ID env var");
}

if (!SIGNING_SECRET) {
  throw new Error("Missing SECRET_KEY env var");
}

const server = new rpc.Server(RPC_URL);
const contract = new Contract(contractId);
const admin = Keypair.fromSecret(SIGNING_SECRET);
const timeoutSeconds = Number(TX_TIMEOUT_SECONDS);
const horizonUrl = HORIZON_URL;
const cliOps = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const UPLOAD_OPS = cliOps.length > 0
  ? cliOps
  : process.env.UPLOAD_OPS
    ? process.env.UPLOAD_OPS.split(",").map((value) => value.trim())
    : OPERATIONS.map((op) => op.opType);

function opTypeToScVal(opType: Operation["opType"]): xdr.ScVal {
  // Rust #[contracttype] enum variants are encoded as vec[symbol(Variant)].
  return scVec([scSymbol(opType)]);
}

function readVerificationKey(vkPath: string): SnarkJsVerificationKey {
  if (!fs.existsSync(vkPath)) {
    throw new Error(`Missing verification key: ${vkPath}`);
  }
  return JSON.parse(fs.readFileSync(vkPath, "utf8")) as SnarkJsVerificationKey;
}

async function submitSetVk(op: Operation): Promise<void> {
  const vkPath = path.join(VK_BUILD_DIR, op.dirName, "verification_key.json");
  const vk = readVerificationKey(vkPath);

  const source = await getSourceAccount();
  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("set_vk", opTypeToScVal(op.opType), verificationKeyToScVal(vk)))
    .setTimeout(timeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed for ${op.opType}: ${simulation.error}`);
  }

  tx = rpc.assembleTransaction(tx, simulation).build();
  tx.sign(admin);

  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`set_vk ${op.opType} failed: ${JSON.stringify(sent.errorResult)}`);
  }

  console.log(`${op.opType}: submitted ${sent.hash}`);
  await waitForTransaction(sent.hash, op.opType);
}

async function waitForTransaction(hash: string, opType: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await server.getTransaction(hash);
    if (result.status === "SUCCESS") {
      console.log(`${opType}: confirmed ${hash}`);
      return;
    }
    if (result.status === "FAILED") {
      throw new Error(`${opType}: transaction failed ${hash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`${opType}: timed out waiting for ${hash}`);
}

async function getSourceAccount(): Promise<Account> {
  try {
    return await server.getAccount(admin.publicKey());
  } catch (error) {
    const account = await fetchHorizonJson(
      `${horizonUrl}/accounts/${admin.publicKey()}`,
    ) as { account_id: string; sequence: string };
    return new Account(account.account_id, account.sequence);
  }
}

async function main(): Promise<void> {
  for (const op of OPERATIONS) {
    if (!UPLOAD_OPS.includes(op.opType)) {
      continue;
    }
    await submitSetVk(op);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

runScript(main);
