import "./bootstrap-env.js";
import fs from "node:fs";
import path from "node:path";
import {
  Address,
  Keypair,
  Networks,
  rpc,
} from "@stellar/stellar-sdk";
import {
  decrypt,
  nativeToEncryptedBalance,
  nativeToJubPoint,
  pkFromSecret,
} from "../src/client.js";
import {
  getSourceAccount,
  runScript,
  simulateContractView,
  type TxEnv,
} from "./tx-helpers.js";

const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
const projectRoot = path.resolve(__dirname, "../..");

async function main(): Promise<void> {
  const target = process.argv[2] ?? "receptor";
  const {
    RPC_URL = "https://soroban-testnet.stellar.org",
    HORIZON_URL = "https://horizon-testnet.stellar.org",
    NETWORK_PASSPHRASE = Networks.TESTNET,
    SECRET_KEY,
    RECEPTOR_SECRET_KEY,
    ENCRYPTED_TOKEN_CONTRACT_ID,
    TEST_RECEPTOR_ADDRESS,
    VK_BUILD_DIR = path.join(projectRoot, "circuits", "build"),
    BABYJUB_SK,
    SENDER_BABYJUB_SK,
    RECEPTOR_BABYJUB_SK,
    DECRYPT_MAX_BALANCE = "1048576",
  } = process.env;

  if (!SECRET_KEY || !ENCRYPTED_TOKEN_CONTRACT_ID) {
    throw new Error("Missing SECRET_KEY or ENCRYPTED_TOKEN_CONTRACT_ID");
  }

  const user =
    target === "owner"
      ? Keypair.fromSecret(SECRET_KEY).publicKey()
      : RECEPTOR_SECRET_KEY
        ? Keypair.fromSecret(RECEPTOR_SECRET_KEY).publicKey()
        : TEST_RECEPTOR_ADDRESS;

  if (!user) {
    throw new Error("Missing TEST_RECEPTOR_ADDRESS for receptor decrypt");
  }

  const sk = loadBabyJubSecret(target, VK_BUILD_DIR, {
    BABYJUB_SK,
    SENDER_BABYJUB_SK,
    RECEPTOR_BABYJUB_SK,
  });

  const txEnv: TxEnv = {
    server: new rpc.Server(RPC_URL),
    signer: Keypair.fromSecret(SECRET_KEY),
    networkPassphrase: NETWORK_PASSPHRASE,
    horizonUrl: HORIZON_URL,
    timeoutSeconds: 180,
  };

  await getSourceAccount(txEnv);

  const chainPkRaw = await simulateContractView(
    txEnv,
    ENCRYPTED_TOKEN_CONTRACT_ID,
    "get_user_pk",
    [Address.fromString(user).toScVal()],
  );
  if (chainPkRaw == null) {
    throw new Error(`No public key stored for ${user}`);
  }

  const chainPk = nativeToJubPoint(chainPkRaw);
  const derivedPk = await pkFromSecret(sk);
  if (chainPk.x !== derivedPk.x || chainPk.y !== derivedPk.y) {
    const transferStatePath = path.join(VK_BUILD_DIR, "transfer", "transfer-state.json");
    if (fs.existsSync(transferStatePath)) {
      const transferState = JSON.parse(
        fs.readFileSync(transferStatePath, "utf8"),
      ) as {
        sender: string;
        receiver: string;
        expectedSenderBalance?: string;
        expectedReceiverBalance?: string;
        amount?: string;
      };

      const expected =
        user === transferState.receiver
          ? transferState.expectedReceiverBalance
          : user === transferState.sender
            ? transferState.expectedSenderBalance
            : undefined;

      if (expected !== undefined) {
        console.warn(
          `Warning: local BabyJub sk does not match on-chain pk for ${user}; ` +
            "showing expected balance from transfer-state.json instead.",
        );
        console.log(`${user} (${target})`);
        console.log(`Expected balance (from last transfer): ${expected}`);
        return;
      }
    }

    throw new Error(
      `BabyJub secret does not match the on-chain public key for ${user}.\n` +
        `  On-chain pk: (${chainPk.x}, ${chainPk.y})\n` +
        `  Local sk derives: (${derivedPk.x}, ${derivedPk.y})\n` +
        "Restore the state file from the successful registration, or register a fresh account.",
    );
  }

  const rawBalance = await simulateContractView(
    txEnv,
    ENCRYPTED_TOKEN_CONTRACT_ID,
    "get_balance",
    [Address.fromString(user).toScVal()],
  );

  if (rawBalance == null) {
    throw new Error(`No encrypted balance stored for ${user}`);
  }

  const encrypted = nativeToEncryptedBalance(rawBalance);
  const plaintext = await decrypt(encrypted, sk, BigInt(DECRYPT_MAX_BALANCE));

  console.log(`${user} (${target})`);
  console.log(`Encrypted c1: (${encrypted.c1.x}, ${encrypted.c1.y})`);
  console.log(`Encrypted c2: (${encrypted.c2.x}, ${encrypted.c2.y})`);
  console.log(`Decrypted balance: ${plaintext.toString()}`);
}

function loadBabyJubSecret(
  target: string,
  vkBuildDir: string,
  env: {
    BABYJUB_SK?: string;
    SENDER_BABYJUB_SK?: string;
    RECEPTOR_BABYJUB_SK?: string;
  },
): bigint {
  if (env.BABYJUB_SK) {
    return BigInt(env.BABYJUB_SK);
  }

  const registerDir = path.join(vkBuildDir, "register");
  const statePath =
    target === "receptor"
      ? path.join(registerDir, "state-receptor.json")
      : path.join(registerDir, "state.json");

  if (target === "receptor" && env.RECEPTOR_BABYJUB_SK) {
    return BigInt(env.RECEPTOR_BABYJUB_SK);
  }
  if (target === "owner" && env.SENDER_BABYJUB_SK) {
    return BigInt(env.SENDER_BABYJUB_SK);
  }

  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as { sk: string };
    return BigInt(state.sk);
  }

  throw new Error(
    target === "receptor"
      ? "Missing BabyJub secret. Set RECEPTOR_BABYJUB_SK, BABYJUB_SK, or run proof-register-receptor"
      : "Missing BabyJub secret. Set SENDER_BABYJUB_SK, BABYJUB_SK, or run proof-register",
  );
}

runScript(main);
