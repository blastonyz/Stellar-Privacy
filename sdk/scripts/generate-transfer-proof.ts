import "./bootstrap-env.js";
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import * as snarkjs from "snarkjs";
import {
  Address,
  Contract,
  Keypair,
  Networks,
  scValToNative,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  buildTransferWitness,
  encrypt,
  pkFromSecret,
  proveTransfer,
  type JubPoint,
} from "../src/client.js";
import {
  encryptedBalanceToScVal,
  proofBytesToScVal,
  publicSignalsToScVal,
  scSymbol,
  scVec,
  transformProofToSoroban,
  type SnarkJsProof,
  type SnarkJsVerificationKey,
  verificationKeyToScVal,
} from "../src/bn254.js";
import {
  buildAndSimulate,
  getSourceAccount,
  sleep,
  runScript,
  submit,
  waitForTransaction,
  type TxEnv,
} from "./tx-helpers.js";

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
  TX_TIMEOUT_SECONDS = "1800",
  VK_BUILD_DIR = path.join(projectRoot, "circuits", "build"),
  ENCRYPTED_TOKEN_CONTRACT_ID,
  TEST_RECEPTOR_ADDRESS,
  SENDER_BABYJUB_SK,
  REGISTER_STATE_PATH = path.join(VK_BUILD_DIR, "register", "state.json"),
  TRANSFER_AMOUNT = "10",
  TRANSFER_FROM_BALANCE = "100",
  TRANSFER_TO_BALANCE = "0",
  UPLOAD_TRANSFER_VK = "",
  SKIP_VK_UPLOAD = "",
  SKIP_ONCHAIN = "",
} = process.env;

const shouldUploadTransferVk =
  UPLOAD_TRANSFER_VK === "1" ||
  UPLOAD_TRANSFER_VK.toLowerCase() === "true";

const signingSecret = SECRET_KEY ?? ADMIN_SECRET;
if (!signingSecret) {
  throw new Error("Missing SECRET_KEY env var");
}
if (!ENCRYPTED_TOKEN_CONTRACT_ID) {
  throw new Error("Missing ENCRYPTED_TOKEN_CONTRACT_ID env var");
}
if (!TEST_RECEPTOR_ADDRESS) {
  throw new Error("Missing TEST_RECEPTOR_ADDRESS env var");
}

const transferDir = path.join(VK_BUILD_DIR, "transfer");
const wasmPath = path.join(transferDir, "transfer_js", "transfer.wasm");
const zkeyPath = path.join(transferDir, "transfer.zkey");
const vkPath = path.join(transferDir, "verification_key.json");
const proofPath = path.join(transferDir, "proof.json");
const publicPath = path.join(transferDir, "public.json");

const txEnv: TxEnv = {
  server: new rpc.Server(RPC_URL),
  signer: Keypair.fromSecret(signingSecret),
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl: HORIZON_URL,
  timeoutSeconds: Number(TX_TIMEOUT_SECONDS),
};

async function main(): Promise<void> {
  assertFile(wasmPath);
  assertFile(zkeyPath);
  assertFile(vkPath);

  const senderAddress = txEnv.signer.publicKey();
  const receiverAddress = TEST_RECEPTOR_ADDRESS;
  console.log(`Sender (owner): ${senderAddress}`);
  console.log(`Receiver: ${receiverAddress}`);

  if (shouldUploadTransferVk) {
    await uploadTransferVk();
  }

  const skFrom = loadSenderSecret();
  const amount = BigInt(TRANSFER_AMOUNT);
  const vFromOld = BigInt(TRANSFER_FROM_BALANCE);
  const vToOld = BigInt(TRANSFER_TO_BALANCE);

  if (vFromOld < amount) {
    throw new Error(`TRANSFER_FROM_BALANCE (${vFromOld}) must be >= TRANSFER_AMOUNT (${amount})`);
  }

  const fromPk = await pkFromSecret(skFrom);
  const fromBalance = await encrypt(vFromOld, fromPk);
  const toPk = await fetchUserPk(receiverAddress);
  const toBalance = await encrypt(vToOld, toPk, 0n);

  const witness = await buildTransferWitness({
    sk_from: skFrom,
    from_balance: fromBalance,
    to_balance: toBalance,
    v_from_old: vFromOld,
    v_to_old: vToOld,
    amount,
    to_pk: toPk,
  });

  const proofResult = await proveTransfer(
    {
      sk_from: skFrom,
      from_balance: fromBalance,
      to_balance: toBalance,
      v_from_old: vFromOld,
      v_to_old: vToOld,
      amount,
      r_s: witness.r_s,
      r_r: witness.r_r,
      to_pk: toPk,
      old_from_hash: witness.old_from_hash,
      new_from_hash: witness.new_from_hash,
      old_to_hash: witness.old_to_hash,
      new_to_hash: witness.new_to_hash,
    },
    wasmPath,
    zkeyPath,
  );

  fs.writeFileSync(proofPath, JSON.stringify(proofResult.rawProof, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(proofResult.publicSignals, null, 2));
  console.log(`Wrote ${proofPath}`);
  console.log(`Wrote ${publicPath}`);

  const vk = readJson<SnarkJsVerificationKey>(vkPath);
  const localOk = await snarkjs.groth16.verify(
    vk,
    proofResult.publicSignals,
    proofResult.rawProof,
  );
  console.log(`Local snarkjs verify: ${localOk}`);
  if (!localOk) {
    throw new Error("Local Groth16 verification failed");
  }

  if (SKIP_ONCHAIN === "1" || SKIP_ONCHAIN.toLowerCase() === "true") {
    return;
  }

  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = new Contract(ENCRYPTED_TOKEN_CONTRACT_ID);
  const transferTx = await buildAndSimulate(
    txEnv,
    token.call(
      "private_transfer",
      Address.fromString(senderAddress).toScVal(),
      Address.fromString(receiverAddress).toScVal(),
      encryptedBalanceToScVal(witness.new_from_balance),
      encryptedBalanceToScVal(witness.new_to_balance),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );
  const sent = await submit(txEnv, transferTx);
  await waitForTransaction(txEnv, sent.hash, "encrypted_token.private_transfer");
  console.log(
    `Transferred ${amount} privately from ${senderAddress} to ${receiverAddress}`,
  );
}

function loadSenderSecret(): bigint {
  if (SENDER_BABYJUB_SK) {
    return BigInt(SENDER_BABYJUB_SK);
  }
  if (!fs.existsSync(REGISTER_STATE_PATH)) {
    throw new Error(
      `Missing BabyJub secret. Set SENDER_BABYJUB_SK or run proof:register to create ${REGISTER_STATE_PATH}`,
    );
  }
  const state = readJson<{ sk: string }>(REGISTER_STATE_PATH);
  return BigInt(state.sk);
}

async function uploadTransferVk(): Promise<void> {
  const vk = readJson<SnarkJsVerificationKey>(vkPath);
  const token = new Contract(ENCRYPTED_TOKEN_CONTRACT_ID!);
  const tx = await buildAndSimulate(
    txEnv,
    token.call("set_vk", opTypeToScVal("Transfer"), verificationKeyToScVal(vk)),
  );
  const sent = await submit(txEnv, tx);
  await waitForTransaction(txEnv, sent.hash, "set_vk Transfer");
  await sleep(3000);
}

async function fetchUserPk(user: string): Promise<JubPoint> {
  const registered = await simulateView("is_registered", [
    Address.fromString(user).toScVal(),
  ]);
  if (!registered) {
    throw new Error(`Receiver ${user} is not registered on the token contract`);
  }

  const pk = await simulateView("get_user_pk", [
    Address.fromString(user).toScVal(),
  ]) as { x: Buffer | Uint8Array; y: Buffer | Uint8Array };

  return {
    x: bytesToBigInt(pk.x),
    y: bytesToBigInt(pk.y),
  };
}

async function simulateView(fn: string, args: xdr.ScVal[]): Promise<unknown> {
  const token = new Contract(ENCRYPTED_TOKEN_CONTRACT_ID!);
  const source = await getSourceAccount(txEnv);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(token.call(fn, ...args))
    .setTimeout(txEnv.timeoutSeconds)
    .build();

  const simulation = await txEnv.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`View simulation failed for ${fn}: ${simulation.error}`);
  }
  if (!simulation.result?.retval) {
    throw new Error(`View ${fn} returned no value`);
  }
  return scValToNative(simulation.result.retval);
}

function bytesToBigInt(value: Buffer | Uint8Array): bigint {
  return BigInt("0x" + Buffer.from(value).toString("hex"));
}

function opTypeToScVal(opType: "Transfer"): xdr.ScVal {
  return scVec([scSymbol(opType)]);
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
