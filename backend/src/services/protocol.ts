import fs from "node:fs";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import {
  buildDepositWitness,
  buildMintWitness,
  buildTransferWitness,
  encrypt,
  generateKeypair,
  pkFromSecret,
  proveDeposit,
  proveMint,
  proveRegister,
  proveTransfer,
  type JubPoint,
} from "../lib/client.js";
import {
  encryptedBalanceToScVal,
  jubJubPointToScVal,
  proofBytesToScVal,
  publicSignalsToScVal,
  transformProofToSoroban,
  type SnarkJsProof,
} from "../lib/bn254.js";
import { proveCircuit } from "../lib/prover.js";
import { assertContractConfigured, circuitPath, config } from "../config.js";
import {
  buildUnsignedTx,
  fetchEncryptedBalance,
  fetchUserPk,
  tokenContract,
} from "./stellar.js";

function assertArtifacts(circuit: string, wasmPath: string, zkeyPath: string): void {
  for (const filePath of [wasmPath, zkeyPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing circuit artifact for ${circuit}: ${filePath}`);
    }
  }
}

export async function buildRegisterTransaction(address: string) {
  assertContractConfigured();
  const registerDir = circuitPath("register");
  const wasmPath = `${registerDir}/register_js/register.wasm`;
  const zkeyPath = `${registerDir}/register.zkey`;
  assertArtifacts("register", wasmPath, zkeyPath);

  const keypair = await generateKeypair();
  const proofResult = await proveRegister(
    keypair.sk,
    wasmPath,
    zkeyPath,
    config.rapidsnarkBin,
  );
  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = tokenContract();
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
      pk: { x: proofResult.pk.x.toString(), y: proofResult.pk.y.toString() },
      pkHash: proofResult.pkHash,
    },
    publicSignals: proofResult.publicSignals,
  };
}

export async function buildTransferTransaction(input: {
  from: string;
  to: string;
  amount: string;
  babyJubSk: string;
  fromBalance?: string;
  toBalance?: string;
}) {
  assertContractConfigured();
  const transferDir = circuitPath("transfer");
  const wasmPath = `${transferDir}/transfer_js/transfer.wasm`;
  const zkeyPath = `${transferDir}/transfer.zkey`;
  assertArtifacts("transfer", wasmPath, zkeyPath);

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
  const toBalanceEnc = await encrypt(vToOld, toPk, 0n);

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
    config.rapidsnarkBin,
  );

  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = tokenContract();
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
  };
}

export async function buildMintTransaction(input: { admin: string; to: string; amount: string }) {
  assertContractConfigured();
  const mintDir = circuitPath("mint");
  const wasmPath = `${mintDir}/mint_js/mint.wasm`;
  const zkeyPath = `${mintDir}/mint.zkey`;
  assertArtifacts("mint", wasmPath, zkeyPath);

  const amount = BigInt(input.amount);
  if (amount < 1n) {
    throw new Error("Mint amount must be >= 1");
  }

  const oldBalance = await fetchEncryptedBalance(input.admin, input.to);
  const toPk = await fetchUserPk(input.admin, input.to);
  const witness = await buildMintWitness({ amount, oldBalance, toPk });

  const proofResult = await proveMint(
    {
      amount,
      oldBalance,
      toPk,
      r: witness.r,
      old_balance_hash: witness.old_balance_hash,
      new_balance_hash: witness.new_balance_hash,
      to_pk_hash: witness.to_pk_hash,
    },
    wasmPath,
    zkeyPath,
    config.rapidsnarkBin,
  );

  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = tokenContract();
  const unsignedXdr = await buildUnsignedTx(
    input.admin,
    token.call(
      "private_mint",
      Address.fromString(input.to).toScVal(),
      encryptedBalanceToScVal(proofResult.newBalance),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );

  return {
    unsignedXdr,
    publicSignals: proofResult.publicSignals,
    publicInputs: {
      old_balance_hash: witness.old_balance_hash,
      new_balance_hash: witness.new_balance_hash,
      to_pk_hash: witness.to_pk_hash,
    },
  };
}

export async function buildDepositTransaction(input: { user: string; amount: string }) {
  assertContractConfigured();
  const depositDir = circuitPath("deposit");
  const wasmPath = `${depositDir}/deposit_js/deposit.wasm`;
  const zkeyPath = `${depositDir}/deposit.zkey`;
  assertArtifacts("deposit", wasmPath, zkeyPath);

  const amount = BigInt(input.amount);
  if (amount < 1n) {
    throw new Error("Deposit amount must be >= 1");
  }

  const oldBalance = await fetchEncryptedBalance(input.user, input.user);
  const userPk = await fetchUserPk(input.user, input.user);
  const witness = await buildDepositWitness({ amount, oldBalance, userPk });

  const proofResult = await proveDeposit(
    {
      amount,
      oldBalance,
      userPk,
      r: witness.r,
      old_balance_hash: witness.old_balance_hash,
      new_balance_hash: witness.new_balance_hash,
    },
    wasmPath,
    zkeyPath,
    config.rapidsnarkBin,
  );

  const proofBytes = transformProofToSoroban(
    proofResult.rawProof as unknown as SnarkJsProof,
    proofResult.publicSignals,
    proofResult.publicSignals.length,
  );

  const token = tokenContract();
  const unsignedXdr = await buildUnsignedTx(
    input.user,
    token.call(
      "deposit",
      Address.fromString(input.user).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      encryptedBalanceToScVal(proofResult.newBalance),
      proofBytesToScVal(proofBytes),
      publicSignalsToScVal(proofBytes.publicSignals),
    ),
  );

  return {
    unsignedXdr,
    publicSignals: proofResult.publicSignals,
    publicInputs: {
      amount: amount.toString(),
      old_balance_hash: witness.old_balance_hash,
      new_balance_hash: witness.new_balance_hash,
    },
  };
}

export async function proveFromWitness(
  circuit: "register" | "mint" | "transfer" | "deposit",
  witness: Record<string, string>,
): Promise<{ proof: unknown; publicSignals: string[] }> {
  const { proof, publicSignals } = await proveCircuit(
    circuit,
    witness,
    config.vkBuildDir,
    config.rapidsnarkBin,
  );
  return { proof, publicSignals };
}

export type { JubPoint };
