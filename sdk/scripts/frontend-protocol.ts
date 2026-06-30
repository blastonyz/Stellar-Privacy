import "./bootstrap-env.js";
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  Address,
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  buildTransferWitness,
  decrypt,
  encrypt,
  generateKeypair,
  nativeToEncryptedBalance,
  pkFromSecret,
  proveRegister,
  proveTransfer,
  type JubPoint,
} from "../src/client.js";
import {
  encryptedBalanceToScVal,
  jubJubPointToScVal,
  proofBytesToScVal,
  publicSignalsToScVal,
  transformProofToSoroban,
  type SnarkJsProof,
} from "../src/bn254.js";

const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
const projectRoot = path.resolve(__dirname, "../..");

loadEnv({ path: path.join(projectRoot, ".env") });
loadEnv({ path: path.join(projectRoot, "frontend", ".env.local"), override: true });

const serverEnv = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
    process.env.NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  contractId:
    process.env.NEXT_PUBLIC_ENCRYPTED_TOKEN_CONTRACT_ID ??
    process.env.ENCRYPTED_TOKEN_CONTRACT_ID ??
    "",
  vkBuildDir: process.env.VK_BUILD_DIR ?? path.join(projectRoot, "circuits", "build"),
  txTimeoutSeconds: Number(process.env.TX_TIMEOUT_SECONDS ?? "1800"),
};

function assertServerEnv(): void {
  if (!serverEnv.contractId) {
    throw new Error("Missing ENCRYPTED_TOKEN_CONTRACT_ID");
  }
}

function circuitPath(...parts: string[]): string {
  return path.join(serverEnv.vkBuildDir, ...parts);
}

async function getAccount(publicKey: string) {
  const server = new rpc.Server(serverEnv.rpcUrl);
  return server.getAccount(publicKey);
}

async function buildUnsignedTx(publicKey: string, operation: xdr.Operation) {
  const server = new rpc.Server(serverEnv.rpcUrl);
  const account = await getAccount(publicKey);
  const baseTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: serverEnv.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(serverEnv.txTimeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(baseTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  return rpc.assembleTransaction(baseTx, simulation).build().toXDR();
}

async function simulateView(
  publicKey: string,
  fn: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  assertServerEnv();
  const contract = new Contract(serverEnv.contractId);
  const account = await getAccount(publicKey);
  const server = new rpc.Server(serverEnv.rpcUrl);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: serverEnv.networkPassphrase,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(serverEnv.txTimeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`View simulation failed for ${fn}: ${simulation.error}`);
  }
  if (!simulation.result?.retval) {
    throw new Error(`View ${fn} returned no value`);
  }

  return scValToNative(simulation.result.retval);
}

async function buildRegisterTransaction(address: string) {
  assertServerEnv();
  const registerDir = circuitPath("register");
  const wasmPath = path.join(registerDir, "register_js", "register.wasm");
  const zkeyPath = path.join(registerDir, "register.zkey");
  for (const filePath of [wasmPath, zkeyPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing circuit artifact: ${filePath}`);
    }
  }

  const keypair = await generateKeypair();
  const proofResult = await proveRegister(keypair.sk, wasmPath, zkeyPath);
  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = new Contract(serverEnv.contractId);
  const unsignedXdr = await buildUnsignedTx(
    address,
    token.call(
      "register",
      Address.fromString(address).toScVal(),
      jubJubPointToScVal({ x: proofResult.pk.x, y: proofResult.pk.y }),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );

  return {
    unsignedXdr,
    babyJub: {
      sk: keypair.sk.toString(),
      pk: {
        x: proofResult.pk.x.toString(),
        y: proofResult.pk.y.toString(),
      },
      pkHash: proofResult.pkHash,
    },
    publicSignals: proofResult.publicSignals,
  };
}

async function fetchUserPk(callerAddress: string, user: string): Promise<JubPoint> {
  const registered = await simulateView(callerAddress, "is_registered", [
    Address.fromString(user).toScVal(),
  ]);
  if (!registered) {
    throw new Error(`Receiver ${user} is not registered`);
  }

  const pk = await simulateView(callerAddress, "get_user_pk", [
    Address.fromString(user).toScVal(),
  ]) as { x: Buffer | Uint8Array; y: Buffer | Uint8Array };

  return {
    x: BigInt(`0x${Buffer.from(pk.x).toString("hex")}`),
    y: BigInt(`0x${Buffer.from(pk.y).toString("hex")}`),
  };
}

async function buildTransferTransaction(input: {
  from: string;
  to: string;
  amount: string;
  babyJubSk: string;
  fromBalance?: string;
  toBalance?: string;
}) {
  assertServerEnv();
  const transferDir = circuitPath("transfer");
  const wasmPath = path.join(transferDir, "transfer_js", "transfer.wasm");
  const zkeyPath = path.join(transferDir, "transfer.zkey");
  for (const filePath of [wasmPath, zkeyPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing circuit artifact: ${filePath}`);
    }
  }

  const skFrom = BigInt(input.babyJubSk);
  const amount = BigInt(input.amount);
  const vFromOld = BigInt(input.fromBalance ?? "100");
  const vToOld = BigInt(input.toBalance ?? "0");

  if (vFromOld < amount) {
    throw new Error(`Insufficient sender balance (${vFromOld} < ${amount})`);
  }

  const fromPk = await pkFromSecret(skFrom);
  const fromBalanceEnc = await encrypt(vFromOld, fromPk);
  const toPk = await fetchUserPk(input.from, input.to);
  const toBalanceEnc = await encrypt(vToOld, toPk, BigInt(0));

  const witness = await buildTransferWitness({
    sk_from: skFrom,
    from_balance: fromBalanceEnc,
    to_balance: toBalanceEnc,
    v_from_old: vFromOld,
    v_to_old: vToOld,
    amount,
    to_pk: toPk,
  });

  const proofResult = await proveTransfer(
    {
      sk_from: skFrom,
      from_balance: fromBalanceEnc,
      to_balance: toBalanceEnc,
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

  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = new Contract(serverEnv.contractId);
  const unsignedXdr = await buildUnsignedTx(
    input.from,
    token.call(
      "private_transfer",
      Address.fromString(input.from).toScVal(),
      Address.fromString(input.to).toScVal(),
      encryptedBalanceToScVal(witness.new_from_balance),
      encryptedBalanceToScVal(witness.new_to_balance),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );

  return {
    unsignedXdr,
    publicSignals: proofResult.publicSignals,
    publicInputs: {
      old_from_hash: witness.old_from_hash,
      new_from_hash: witness.new_from_hash,
      old_to_hash: witness.old_to_hash,
      new_to_hash: witness.new_to_hash,
    },
    transferState: {
      sender: input.from,
      receiver: input.to,
      amount: amount.toString(),
      expectedSenderBalance: (vFromOld - amount).toString(),
      expectedReceiverBalance: (vToOld + amount).toString(),
    },
  };
}

async function decryptBalance(input: {
  babyJubSk: string;
  encryptedBalance: unknown;
  maxBalance?: string;
}) {
  const plaintext = await decrypt(
    nativeToEncryptedBalance(input.encryptedBalance),
    BigInt(input.babyJubSk),
    BigInt(input.maxBalance ?? "1000000"),
  );
  return plaintext.toString();
}

async function main(): Promise<void> {
  const [command, payloadJson] = process.argv.slice(2);
  if (!command || !payloadJson) {
    throw new Error("Usage: frontend-protocol.ts <register|transfer|decrypt> '<json>'");
  }

  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  let result: unknown;

  switch (command) {
    case "register":
      result = await buildRegisterTransaction(String(payload.address));
      break;
    case "transfer":
      result = await buildTransferTransaction(payload as Parameters<typeof buildTransferTransaction>[0]);
      break;
    case "decrypt":
      result = { balance: await decryptBalance(payload as Parameters<typeof decryptBalance>[0]) };
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
