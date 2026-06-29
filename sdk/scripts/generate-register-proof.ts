import "./bootstrap-env.js";
import fs from "node:fs";
import path from "node:path";
import * as snarkjs from "snarkjs";
import {
  Address,
  Contract,
  Keypair,
  Networks,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import { generateKeypair, proveRegister } from "../src/client.js";
import {
  jubJubPointToScVal,
  proofBytesToScVal,
  publicSignalsToScVal,
  transformProofToSoroban,
  type SnarkJsProof,
  type SnarkJsVerificationKey,
  verificationKeyToScVal,
} from "../src/bn254.js";
import {
  buildAndSimulate,
  isAlreadyRegisteredError,
  isRegistered,
  runScript,
  submit,
  waitForTransaction,
  type TxEnv,
} from "./tx-helpers.js";

const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
const projectRoot = path.resolve(__dirname, "../..");

const {
  HORIZON_URL = "https://horizon-testnet.stellar.org",
  RPC_URL = "https://soroban-testnet.stellar.org",
  NETWORK_PASSPHRASE = Networks.TESTNET,
  SECRET_KEY,
  ADMIN_SECRET,
  TX_TIMEOUT_SECONDS = "1800",
  VK_BUILD_DIR = path.join(projectRoot, "circuits", "build"),
  GROTH16_VERIFIER_CONTRACT_ID,
  ENCRYPTED_TOKEN_CONTRACT_ID,
  SKIP_ONCHAIN = "",
  REGISTER_TARGET = "owner",
  RECEPTOR_SECRET_KEY,
} = process.env;

const cliTarget = process.argv.includes("--receptor") ? "receptor" : undefined;
const registerTarget = (cliTarget ?? REGISTER_TARGET).toLowerCase();
const signingSecret =
  registerTarget === "receptor"
    ? RECEPTOR_SECRET_KEY
    : (SECRET_KEY ?? ADMIN_SECRET);
if (!signingSecret) {
  throw new Error(
    registerTarget === "receptor"
      ? "Missing RECEPTOR_SECRET_KEY env var"
      : "Missing SECRET_KEY env var",
  );
}

const registerDir = path.join(VK_BUILD_DIR, "register");
const wasmPath = path.join(registerDir, "register_js", "register.wasm");
const zkeyPath = path.join(registerDir, "register.zkey");
const vkPath = path.join(registerDir, "verification_key.json");
const proofPath = path.join(registerDir, "proof.json");
const publicPath = path.join(registerDir, "public.json");

const statePath = path.join(
  registerDir,
  registerTarget === "receptor" ? "state-receptor.json" : "state.json",
);

const signer = Keypair.fromSecret(signingSecret);
const stellarAddress = signer.publicKey();
const txEnv: TxEnv = {
  server: new rpc.Server(RPC_URL),
  signer,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl: HORIZON_URL,
  timeoutSeconds: Number(TX_TIMEOUT_SECONDS),
};

async function main(): Promise<void> {
  assertFile(wasmPath);
  assertFile(zkeyPath);
  assertFile(vkPath);

  if (
    ENCRYPTED_TOKEN_CONTRACT_ID &&
    SKIP_ONCHAIN !== "1" &&
    SKIP_ONCHAIN.toLowerCase() !== "true"
  ) {
    const alreadyRegistered = await isRegistered(
      txEnv,
      ENCRYPTED_TOKEN_CONTRACT_ID,
      stellarAddress,
    );
    if (alreadyRegistered) {
      console.log(`${stellarAddress} is already registered (${registerTarget})`);
      if (fs.existsSync(statePath)) {
        console.log(`Existing state: ${statePath}`);
      } else {
        console.log(
          "No local state file found; BabyJub sk was not saved from the original registration.",
        );
      }
      return;
    }
  }

  const keypair = await generateKeypair();
  console.log("Generated BabyJubJub keypair for registration");

  const proofResult = await proveRegister(keypair.sk, wasmPath, zkeyPath);
  const snarkProof = proofResult.rawProof;

  fs.writeFileSync(proofPath, JSON.stringify(snarkProof, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(proofResult.publicSignals, null, 2));
  fs.writeFileSync(
    statePath,
    JSON.stringify(
      {
        stellarAddress,
        sk: keypair.sk.toString(),
        pk: { x: proofResult.pk.x.toString(), y: proofResult.pk.y.toString() },
        pkHash: proofResult.pkHash,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${statePath}`);

  const vk = readJson<SnarkJsVerificationKey>(vkPath);
  const localOk = await snarkjs.groth16.verify(
    vk,
    proofResult.publicSignals,
    snarkProof,
  );
  console.log(`Local snarkjs verify: ${localOk}`);
  if (!localOk) {
    throw new Error("Local Groth16 verification failed");
  }

  if (SKIP_ONCHAIN === "1" || SKIP_ONCHAIN.toLowerCase() === "true") {
    return;
  }

  if (!GROTH16_VERIFIER_CONTRACT_ID) {
    throw new Error("Missing GROTH16_VERIFIER_CONTRACT_ID env var");
  }

  const proofBytes = transformProofToSoroban(
    snarkProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const verifier = new Contract(GROTH16_VERIFIER_CONTRACT_ID);
  const verifyTx = await buildAndSimulate(
    txEnv,
    verifier.call(
      "verify",
      verificationKeyToScVal(vk),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );
  const verifySent = await submit(txEnv, verifyTx);
  const verifyResult = await waitForTransaction(txEnv, verifySent.hash, "verifier.verify");
  const verifyReturn = verifyResult.returnValue
    ? scValToNative(verifyResult.returnValue)
    : undefined;
  console.log(`On-chain verifier.verify: ${verifyReturn}`);
  if (verifyReturn !== true) {
    throw new Error("On-chain verifier returned false");
  }

  if (!ENCRYPTED_TOKEN_CONTRACT_ID) {
    console.log("ENCRYPTED_TOKEN_CONTRACT_ID not set; skipping token.register");
    return;
  }

  const token = new Contract(ENCRYPTED_TOKEN_CONTRACT_ID);
  try {
    const registerTx = await buildAndSimulate(
      txEnv,
      token.call(
        "register",
        Address.fromString(stellarAddress).toScVal(),
        jubJubPointToScVal({ x: proofResult.pk.x, y: proofResult.pk.y }),
        proofBytesToScVal(proofBytes),
        publicSignalsToScVal(proofBytes.publicSignals),
      ),
    );
    const registerSent = await submit(txEnv, registerTx);
    await waitForTransaction(txEnv, registerSent.hash, "encrypted_token.register");
  } catch (error) {
    if (isAlreadyRegisteredError(error)) {
      console.log(`${stellarAddress} is already registered (${registerTarget})`);
      return;
    }
    throw error;
  }

  console.log(`Wrote ${proofPath}`);
  console.log(`Wrote ${publicPath}`);
  console.log(`Registered ${stellarAddress} (${registerTarget})`);
}

function assertFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

runScript(main);
