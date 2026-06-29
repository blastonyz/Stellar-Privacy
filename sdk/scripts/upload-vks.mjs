import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as StellarSdk from "@stellar/stellar-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const OPS = [
  ["Register", "register"],
  ["Mint", "mint"],
  ["Transfer", "transfer"],
  ["Deposit", "deposit"],
  ["Withdraw", "withdraw"],
];

const {
  RPC_URL = "https://soroban-testnet.stellar.org",
  NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET,
  CONTRACT_ID,
  ADMIN_SECRET,
} = process.env;

if (!CONTRACT_ID) {
  throw new Error("Missing CONTRACT_ID env var");
}

if (!ADMIN_SECRET) {
  throw new Error("Missing ADMIN_SECRET env var");
}

const xdr = StellarSdk.xdr;
const admin = StellarSdk.Keypair.fromSecret(ADMIN_SECRET);
const rpc = new StellarSdk.rpc.Server(RPC_URL);
const contract = new StellarSdk.Contract(CONTRACT_ID);

function symbol(name) {
  return xdr.ScVal.scvSymbol(name);
}

function fieldBytes(value) {
  const bigint = BigInt(value);
  if (bigint < 0n) {
    throw new Error(`Negative field element: ${value}`);
  }

  let hex = bigint.toString(16);
  if (hex.length > 64) {
    throw new Error(`Field element exceeds 32 bytes: ${value}`);
  }
  hex = hex.padStart(64, "0");

  return xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
}

function struct(entries) {
  return xdr.ScVal.scvMap(
    entries.map(([key, val]) =>
      new xdr.ScMapEntry({
        key: symbol(key),
        val,
      })
    )
  );
}

function vec(values) {
  return xdr.ScVal.scvVec(values);
}

function g1(point) {
  return struct([
    ["x", fieldBytes(point[0])],
    ["y", fieldBytes(point[1])],
  ]);
}

// snarkjs stores Fq2 values in Solidity order: [c1, c0].
// The Rust contract expects BN254Fq2 { c0, c1 }.
function fq2(pair) {
  return struct([
    ["c0", fieldBytes(pair[1])],
    ["c1", fieldBytes(pair[0])],
  ]);
}

function g2(point) {
  return struct([
    ["x", fq2(point[0])],
    ["y", fq2(point[1])],
  ]);
}

function opType(name) {
  return vec([symbol(name)]);
}

function verificationKeyToScVal(vk) {
  if (vk.curve !== "bn128") {
    throw new Error(`Expected snarkjs BN254/bn128 VK, got curve=${vk.curve}`);
  }

  return struct([
    ["alpha", g1(vk.vk_alpha_1)],
    ["beta", g2(vk.vk_beta_2)],
    ["gamma", g2(vk.vk_gamma_2)],
    ["delta", g2(vk.vk_delta_2)],
    ["ic", vec(vk.IC.map(g1))],
  ]);
}

async function submitSetVk(opName, vkPath) {
  const vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));
  const source = await rpc.getAccount(admin.publicKey());

  let tx = new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("set_vk", opType(opName), verificationKeyToScVal(vk)))
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed for ${opName}: ${simulation.error}`);
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  tx.sign(admin);

  const send = await rpc.sendTransaction(tx);
  if (send.status === "ERROR") {
    throw new Error(`set_vk ${opName} failed: ${JSON.stringify(send.errorResult)}`);
  }

  console.log(`${opName}: ${send.hash}`);
}

for (const [opName, dirName] of OPS) {
  const vkPath = path.join(root, "circuits", "build", dirName, "verification_key.json");
  await submitSetVk(opName, vkPath);
}
