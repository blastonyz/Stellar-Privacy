import "./bootstrap-env.js";
import { runScript } from "./tx-helpers.js";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  proofBytesToScVal,
  publicSignalsToScVal,
  scSymbol,
  scVec,
  transformProofToSoroban,
  type SnarkJsProof,
  type SnarkJsVerificationKey,
  verificationKeyToScVal,
} from "../src/bn254.js";
import { fetchHorizonJson } from "./stellar-fetch.js";

type OperationName = "Register" | "Mint" | "Transfer" | "Deposit" | "Withdraw";

const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
const projectRoot = path.resolve(__dirname, "../..");

loadEnv({ path: path.join(projectRoot, ".env") });
loadEnv({ path: path.join(projectRoot, "sdk", ".env"), override: false });

const {
  HORIZON_URL = "https://horizon-testnet.stellar.org",
  RPC_URL = "https://soroban-testnet.stellar.org",
  NETWORK_PASSPHRASE = Networks.TESTNET,
  SECRET_KEY,
  ADMIN_SECRET,
  TX_TIMEOUT_SECONDS = "180",
  VK_BUILD_DIR = path.join(projectRoot, "circuits", "build"),
  SAMPLE_PROOF_JSON,
  SAMPLE_PUBLIC_JSON,
  MAX_CONTRACT_WASM_BYTES = "65536",
  SKIP_BUILD,
} = process.env;

const signingSecret = SECRET_KEY ?? ADMIN_SECRET;

if (!signingSecret) {
  throw new Error("Missing SECRET_KEY env var");
}

const server = new rpc.Server(RPC_URL);
const admin = Keypair.fromSecret(signingSecret);
const timeoutSeconds = Number(TX_TIMEOUT_SECONDS);
const maxContractWasmBytes = Number(MAX_CONTRACT_WASM_BYTES);
const releaseDir = path.join(projectRoot, "target", "wasm32v1-none", "release");
const verifierWasm = path.join(releaseDir, "groth16_verifier.optimized.wasm");
const tokenWasm = path.join(releaseDir, "encrypted_token.optimized.wasm");

async function main(): Promise<void> {
  if (!SKIP_BUILD) {
    buildOptimizedContracts();
  }

  assertWasmFits("groth16_verifier", verifierWasm);
  assertWasmFits("encrypted_token", tokenWasm);

  const verifierHash = await uploadWasm("groth16_verifier", verifierWasm);
  const verifierId = await deployContract("groth16_verifier", verifierHash, []);

  const tokenHash = await uploadWasm("encrypted_token", tokenWasm);
  const tokenId = await deployContract("encrypted_token", tokenHash, [
    Address.fromString(admin.publicKey()).toScVal(),
    Address.fromString(verifierId).toScVal(),
  ]);

  console.log(`GROTH16_VERIFIER_CONTRACT_ID=${verifierId}`);
  console.log(`ENCRYPTED_TOKEN_CONTRACT_ID=${tokenId}`);
  writeContractIdsToEnv(verifierId, tokenId);

  await uploadVerificationKey(tokenId, "Register", path.join(VK_BUILD_DIR, "register", "verification_key.json"));

  const allOps: OperationName[] = ["Register", "Mint", "Transfer", "Deposit", "Withdraw"];
  for (const op of allOps) {
    const dir = op.toLowerCase();
    const vkPath = path.join(VK_BUILD_DIR, dir, "verification_key.json");
    if (!fs.existsSync(vkPath)) {
      console.warn(`Skipping ${op} VK — missing ${vkPath}`);
      continue;
    }
    if (op === "Register") continue;
    await uploadVerificationKey(tokenId, op, vkPath);
  }

  if (SAMPLE_PROOF_JSON && SAMPLE_PUBLIC_JSON) {
    await verifySampleProof(verifierId, path.join(VK_BUILD_DIR, "register", "verification_key.json"));
  } else {
    console.log("Skipping direct on-chain proof validation: set SAMPLE_PROOF_JSON and SAMPLE_PUBLIC_JSON to enable it.");
  }
}

function buildOptimizedContracts(): void {
  execFileSync("cargo", ["build", "--target", "wasm32v1-none", "--release", "-p", "groth16_verifier", "-p", "encrypted_token"], {
    cwd: projectRoot,
    env: { ...process.env, CARGO_HTTP_CHECK_REVOKE: "false" },
    stdio: "inherit",
  });

  optimizeWasm("groth16_verifier");
  optimizeWasm("encrypted_token");
}

function optimizeWasm(name: string): void {
  execFileSync(
    "stellar",
    [
      "contract",
      "optimize",
      "--wasm",
      path.join(releaseDir, `${name}.wasm`),
      "--wasm-out",
      path.join(releaseDir, `${name}.optimized.wasm`),
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
}

async function uploadWasm(name: string, wasmPath: string): Promise<Buffer> {
  const wasm = fs.readFileSync(wasmPath);
  const hash = crypto.createHash("sha256").update(wasm).digest();

  const tx = await buildAndSimulate(Operation.uploadContractWasm({ wasm }));
  const sent = await submit(tx);
  await waitForTransaction(sent.hash, `${name} upload`);

  console.log(`${name}: wasm hash ${hash.toString("hex")}`);
  return hash;
}

function assertWasmFits(name: string, wasmPath: string): void {
  const size = fs.statSync(wasmPath).size;
  if (size > maxContractWasmBytes) {
    throw new Error(
      `${name} optimized WASM is ${size} bytes, above the ${maxContractWasmBytes} byte network limit`,
    );
  }
}

async function deployContract(name: string, wasmHash: Buffer, constructorArgs: xdr.ScVal[]): Promise<string> {
  const tx = await buildAndSimulate(
    Operation.createCustomContract({
      address: Address.fromString(admin.publicKey()),
      wasmHash,
      constructorArgs,
    }),
  );

  const sent = await submit(tx);
  const result = await waitForTransaction(sent.hash, `${name} deploy`);
  if (!result.returnValue) {
    throw new Error(`${name} deploy did not return a contract address`);
  }

  return Address.fromScVal(result.returnValue).toString();
}

async function uploadVerificationKey(contractId: string, op: OperationName, vkPath: string): Promise<void> {
  const vk = readJson<SnarkJsVerificationKey>(vkPath);
  const contract = new Contract(contractId);
  const tx = await buildAndSimulate(
    contract.call("set_vk", opTypeToScVal(op), verificationKeyToScVal(vk)),
  );

  const sent = await submit(tx);
  await waitForTransaction(sent.hash, `set_vk ${op}`);
}

async function verifySampleProof(verifierId: string, vkPath: string): Promise<void> {
  if (!SAMPLE_PROOF_JSON || !SAMPLE_PUBLIC_JSON) {
    return;
  }

  const vk = readJson<SnarkJsVerificationKey>(vkPath);
  const proof = readJson<SnarkJsProof>(SAMPLE_PROOF_JSON);
  const publicSignals = readJson<string[]>(SAMPLE_PUBLIC_JSON);
  const proofBytes = transformProofToSoroban(proof, publicSignals, publicSignals.length);

  const contract = new Contract(verifierId);
  const tx = await buildAndSimulate(
    contract.call(
      "verify",
      verificationKeyToScVal(vk),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );

  const sent = await submit(tx);
  const result = await waitForTransaction(sent.hash, "sample proof verify");
  console.log(`sample proof verify return=${result.returnValue?.switch().name ?? "none"}`);
}

async function buildAndSimulate(operation: xdr.Operation): Promise<any> {
  const source = await getSourceAccount();
  const baseTx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(timeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(baseTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  return rpc.assembleTransaction(baseTx, simulation).build();
}

async function getSourceAccount(): Promise<Account> {
  try {
    return await server.getAccount(admin.publicKey());
  } catch (error) {
    let account: { account_id: string; sequence: string };
    try {
      account = await fetchHorizonJson(
        `${HORIZON_URL}/accounts/${admin.publicKey()}`,
      ) as { account_id: string; sequence: string };
    } catch {
      throw error;
    }
    return new Account(account.account_id, account.sequence);
  }
}

async function submit(tx: any): Promise<rpc.Api.SendTransactionResponse> {
  tx.sign(admin);

  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(sent.errorResult)}`);
  }
  return sent;
}

async function waitForTransaction(
  hash: string,
  label: string,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await server.getTransaction(hash);
    if (result.status === "SUCCESS") {
      console.log(`${label}: confirmed ${hash}`);
      return result;
    }
    if (result.status === "FAILED") {
      throw new Error(`${label}: transaction failed ${hash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`${label}: timed out waiting for ${hash}`);
}

function opTypeToScVal(opType: OperationName): xdr.ScVal {
  return scVec([scSymbol(opType)]);
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeContractIdsToEnv(verifierId: string, tokenId: string): void {
  const envPath = path.join(projectRoot, ".env");
  let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  contents = setEnvValue(contents, "GROTH16_VERIFIER_CONTRACT_ID", verifierId);
  contents = setEnvValue(contents, "ENCRYPTED_TOKEN_CONTRACT_ID", tokenId);

  fs.writeFileSync(envPath, contents);
  console.log(`Updated ${envPath}`);

  const frontendEnvPath = path.join(projectRoot, "frontend", ".env.local");
  let frontendContents = fs.existsSync(frontendEnvPath)
    ? fs.readFileSync(frontendEnvPath, "utf8")
    : "";
  frontendContents = setEnvValue(
    frontendContents,
    "NEXT_PUBLIC_ENCRYPTED_TOKEN_CONTRACT_ID",
    tokenId,
  );
  fs.writeFileSync(frontendEnvPath, frontendContents);
  console.log(`Updated ${frontendEnvPath}`);
}

function setEnvValue(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const suffix = contents.endsWith("\n") || contents.length === 0 ? "" : "\n";
  return `${contents}${suffix}${line}\n`;
}

runScript(main);
