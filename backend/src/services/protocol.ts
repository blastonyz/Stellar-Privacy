import fs from "node:fs";
import { Address, Keypair, nativeToScVal } from "@stellar/stellar-sdk";
import {
  buildDepositWitness,
  buildMintWitness,
  buildTransferWitness,
  decrypt,
  encrypt,
  generateKeypair,
  proveDeposit,
  proveMint,
  proveRegister,
  proveTransfer,
  type JubPoint,
} from "../lib/client.js";
import { resolveReceiverViewKey, readCounterpartyRegisterState } from "../lib/receptor-keys.js";
import { readRegisterState, saveRegisterState } from "../lib/register-state-store.js";
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
  fetchEncryptedBalanceOptional,
  fetchIsRegistered,
  fetchUserPk,
  isAlreadyRegisteredError,
  signAndSubmitFromSecret,
  tokenContract,
} from "./stellar.js";

function assertArtifacts(circuit: string, wasmPath: string, zkeyPath: string): void {
  for (const filePath of [wasmPath, zkeyPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing circuit artifact for ${circuit}: ${filePath}`);
    }
  }
}

async function decryptSenderBalance(
  balance: Awaited<ReturnType<typeof fetchEncryptedBalanceOptional>>,
  sk: bigint,
): Promise<bigint> {
  try {
    return await decrypt(balance!, sk);
  } catch {
    throw new Error(
      "Could not decrypt sender balance — your view key may not match on-chain registration. Re-import your view key backup.",
    );
  }
}

async function decryptReceiverBalance(
  balance: Awaited<ReturnType<typeof fetchEncryptedBalanceOptional>>,
  sk: bigint,
): Promise<bigint> {
  try {
    return await decrypt(balance!, sk);
  } catch {
    throw new Error(
      "Could not decrypt receiver balance — import the counterparty view key or set receiver old balance.",
    );
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

  const babyJub = {
    sk: keypair.sk.toString(),
    pk: { x: proofResult.pk.x.toString(), y: proofResult.pk.y.toString() },
    pkHash: proofResult.pkHash,
  };

  await saveRegisterState(address, babyJub, "register");

  return {
    unsignedXdr,
    babyJub,
    publicSignals: proofResult.publicSignals,
  };
}

/** Demo flow: prove + sign + submit register for a counterparty using their Stellar secret (testnet). */
export async function registerCounterpartyWithSecret(secretKey: string) {
  assertContractConfigured();
  const trimmed = secretKey.trim();
  if (!trimmed.startsWith("S")) {
    throw new Error("Invalid Stellar secret key format");
  }

  let keypair: ReturnType<typeof Keypair.fromSecret>;
  try {
    keypair = Keypair.fromSecret(trimmed);
  } catch {
    throw new Error("Invalid Stellar secret key");
  }

  const address = keypair.publicKey();
  const caller = config.adminPublicKey || address;
  const alreadyRegistered = await fetchIsRegistered(caller, address);
  if (alreadyRegistered) {
    const state = (await readCounterpartyRegisterState(address)) ?? (await readRegisterState(address));
    return {
      address,
      alreadyRegistered: true as const,
      txHash: null,
      babyJub: state
        ? {
            sk: state.sk,
            pk: state.pk
              ? { x: state.pk.x, y: state.pk.y }
              : { x: "0", y: "0" },
            pkHash: state.pkHash ?? "",
          }
        : null,
    };
  }

  const payload = await buildRegisterTransaction(address);
  try {
    const { hash } = await signAndSubmitFromSecret(trimmed, payload.unsignedXdr);
    return {
      address,
      alreadyRegistered: false as const,
      txHash: hash,
      babyJub: payload.babyJub,
      publicSignals: payload.publicSignals,
    };
  } catch (error) {
    if (isAlreadyRegisteredError(error)) {
      const state = await readRegisterState(address);
      return {
        address,
        alreadyRegistered: true as const,
        txHash: null,
        babyJub: state
          ? {
              sk: state.sk,
              pk: state.pk,
              pkHash: state.pkHash,
            }
          : null,
      };
    }
    throw error;
  }
}

export async function buildTransferTransaction(input: {
  from: string;
  to: string;
  amount: string;
  babyJubSk: string;
  toBabyJubSk?: string;
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

  const [toPk, fromBalanceEnc, toBalanceOnChain] = await Promise.all([
    fetchUserPk(input.from, input.to),
    fetchEncryptedBalanceOptional(input.from, input.from),
    fetchEncryptedBalanceOptional(input.from, input.to),
  ]);

  if (!fromBalanceEnc) {
    throw new Error("Sender has no encrypted balance on-chain — mint or deposit first");
  }

  const toBalanceEnc =
    toBalanceOnChain ?? (await encrypt(0n, toPk, 0n));

  const vFromOld =
    input.fromBalance !== undefined
      ? BigInt(input.fromBalance)
      : await decryptSenderBalance(fromBalanceEnc, skFrom);

  const resolvedToSk = await resolveReceiverViewKey(input.to, input.toBabyJubSk);

  let vToOld: bigint;
  if (input.toBalance !== undefined) {
    vToOld = BigInt(input.toBalance);
  } else if (resolvedToSk) {
    vToOld = await decryptReceiverBalance(toBalanceEnc, BigInt(resolvedToSk));
  } else if (!toBalanceOnChain) {
    vToOld = 0n;
  } else {
    throw new Error(
      "Receiver has an on-chain balance — import their view key in this browser, set receiver old balance, or register via make proof-register-receptor",
    );
  }

  if (vFromOld < amount) {
    throw new Error(`Insufficient sender balance (${vFromOld} < ${amount})`);
  }

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
