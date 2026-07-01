/**
 * EncryptedToken SDK — Client-side operations
 *
 * Handles:
 *   • BLS12-381 keypair generation (Jubjub embedded curve)
 *   • Twisted ElGamal encryption / decryption
 *   • Groth16 proof generation via snarkjs
 *   • Transaction building and submission to Soroban
 *
 * Dependencies:
 *   npm install @stellar/stellar-sdk snarkjs @noble/curves
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { buildBabyjub, buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import {
  encryptedBalanceToScVal,
  fieldElementToBytes,
  proofBytesToScVal,
  publicSignalsToScVal as publicSignalBytesToScVal,
  transformProofToSoroban,
  type SnarkJsProof,
} from "./bn254.js";
import { groth16Prove } from "./prover.js";

export { transformProofToSoroban } from "./bn254.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Keypair {
  sk: bigint;          // secret key (Jubjub scalar)
  pk: JubPoint;        // public key = sk * G (Jubjub point)
}

export interface JubPoint {
  x: bigint;
  y: bigint;
}

export interface EncryptedBalance {
  c1: JubPoint;   // r * G
  c2: JubPoint;   // v * G + r * PK
}

export function nativeToJubPoint(value: unknown): JubPoint {
  const point = value as { x: Buffer | Uint8Array; y: Buffer | Uint8Array };
  return {
    x: fieldBytesToBigInt(point.x),
    y: fieldBytesToBigInt(point.y),
  };
}

export function nativeToEncryptedBalance(value: unknown): EncryptedBalance {
  const balance = value as {
    c1: { x: Buffer | Uint8Array; y: Buffer | Uint8Array };
    c2: { x: Buffer | Uint8Array; y: Buffer | Uint8Array };
  };

  return {
    c1: nativeToJubPoint(balance.c1),
    c2: nativeToJubPoint(balance.c2),
  };
}

function fieldBytesToBigInt(value: Buffer | Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(value).toString("hex")}`);
}

export interface Groth16Proof {
  a: [string, string];          // G1
  b: [[string, string], [string, string]];  // G2
  c: [string, string];          // G1
  publicSignals: string[];
}

function normalizeGroth16Proof(
  proof: snarkjs.Groth16Proof,
  publicSignals: snarkjs.PublicSignals
): Groth16Proof {
  return {
    a: [String(proof.pi_a[0]), String(proof.pi_a[1])],
    b: [
      [String(proof.pi_b[0][0]), String(proof.pi_b[0][1])],
      [String(proof.pi_b[1][0]), String(proof.pi_b[1][1])],
    ],
    c: [String(proof.pi_c[0]), String(proof.pi_c[1])],
    publicSignals: publicSignals.map(String),
  };
}

// ─── Network config ─────────────────────────────────────────────────────────

const TESTNET_RPC = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

// ─── Crypto primitives ──────────────────────────────────────────────────────

/**
 * Generate a random Jubjub keypair.
 * The secret key is a random scalar in the Jubjub field.
 * The public key is PK = sk * G.
 */
export async function generateKeypair(): Promise<Keypair> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const scalarLimit = BigInt(babyjub.subOrder);

  // BabyPbk in the register circuit decomposes scalars with Num2Bits(251).
  let sk = 0n;
  while (sk === 0n) {
    const skBytes = crypto.getRandomValues(new Uint8Array(32));
    sk = BigInt("0x" + Buffer.from(skBytes).toString("hex")) % scalarLimit;
  }

  const pkPoint = babyjub.mulPointEscalar(babyjub.Base8, sk);
  const pk: JubPoint = {
    x: F.toObject(pkPoint[0]),
    y: F.toObject(pkPoint[1]),
  };

  return { sk, pk };
}

export function randomScalar(babyjub: Awaited<ReturnType<typeof buildBabyjub>>): bigint {
  const scalarLimit = BigInt(babyjub.subOrder);
  let sk = 0n;
  while (sk === 0n) {
    const skBytes = crypto.getRandomValues(new Uint8Array(32));
    sk = BigInt("0x" + Buffer.from(skBytes).toString("hex")) % scalarLimit;
  }
  return sk;
}

export async function pkFromSecret(sk: bigint): Promise<JubPoint> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const pkPoint = babyjub.mulPointEscalar(babyjub.Base8, sk);
  return {
    x: F.toObject(pkPoint[0]),
    y: F.toObject(pkPoint[1]),
  };
}

/**
 * Encrypt a value v under public key PK using Twisted ElGamal on Jubjub.
 *
 *   C1 = r * G
 *   C2 = v * G + r * PK
 *
 * @param v     plaintext value (non-negative integer)
 * @param pk    recipient's Jubjub public key
 * @returns     ElGamal ciphertext (C1, C2)
 */
export async function encrypt(
  v: bigint,
  pk: JubPoint,
  r?: bigint   // optional: provide deterministic randomness (testing only)
): Promise<EncryptedBalance> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;

  // Random blinding factor r
  const randomness = r ?? (
    randomScalar(babyjub)
  );

  // C1 = r * G
  const c1Point = babyjub.mulPointEscalar(babyjub.Base8, randomness);

  // v * G
  const vG = babyjub.mulPointEscalar(babyjub.Base8, v);

  // r * PK
  const pkPoint = [F.fromObject(pk.x), F.fromObject(pk.y)];
  const rPK = babyjub.mulPointEscalar(pkPoint, randomness);

  // C2 = v * G + r * PK
  const c2Point = babyjub.addPoint(vG, rPK);

  return {
    c1: { x: F.toObject(c1Point[0]), y: F.toObject(c1Point[1]) },
    c2: { x: F.toObject(c2Point[0]), y: F.toObject(c2Point[1]) },
  };
}

/**
 * Decrypt an ElGamal ciphertext using the secret key.
 *
 *   v * G = C2 - sk * C1
 *
 * Then compute v by baby-step giant-step (works for v < 2^40).
 *
 * @param balance  encrypted balance
 * @param sk       user's secret key
 * @param maxV     maximum expected value (default 1e6 — matches frontend decrypt)
 */
export async function decrypt(
  balance: EncryptedBalance,
  sk: bigint,
  maxV = 1_000_000n,
): Promise<bigint> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;

  const c1 = [F.fromObject(balance.c1.x), F.fromObject(balance.c1.y)];
  const c2 = [F.fromObject(balance.c2.x), F.fromObject(balance.c2.y)];

  // sk * C1
  const skC1 = babyjub.mulPointEscalar(c1, sk);
  // neg(sk * C1)
  const negSkC1 = babyjub.packPoint(skC1);  // we need point negation
  // C2 - sk * C1 = C2 + neg(sk * C1)
  const negSkC1Point = [F.neg(skC1[0]), skC1[1]]; // Jubjub negation: negate x
  const vG = babyjub.addPoint(c2, negSkC1Point);

  // Baby-step giant-step to recover v from v * G
  return babyStepGiantStep(babyjub, vG, maxV);
}

/**
 * Baby-step giant-step discrete log on Jubjub.
 * O(sqrt(maxV)) time, O(sqrt(maxV)) space.
 * Works for v < maxV ≈ 2^40.
 */
async function babyStepGiantStep(
  babyjub: any,
  target: any,
  maxV: bigint
): Promise<bigint> {
  const F = babyjub.F;
  const sqrtMax = BigInt(Math.ceil(Math.sqrt(Number(maxV))));

  // Baby steps: map i * G -> i, starting at the identity (0 * G).
  const table = new Map<string, bigint>();
  let baby = [F.zero, F.one];
  for (let i = 0n; i <= sqrtMax; i++) {
    const key = `${F.toObject(baby[0])},${F.toObject(baby[1])}`;
    if (!table.has(key)) {
      table.set(key, i);
    }
    baby = babyjub.addPoint(baby, babyjub.Base8);
  }

  const giantStep = babyjub.mulPointEscalar(babyjub.Base8, sqrtMax);
  const negGiantStep = [F.neg(giantStep[0]), giantStep[1]];

  let giant = target;
  for (let j = 0n; j <= sqrtMax; j++) {
    const key = `${F.toObject(giant[0])},${F.toObject(giant[1])}`;
    if (table.has(key)) {
      return j * sqrtMax + table.get(key)!;
    }
    giant = babyjub.addPoint(giant, negGiantStep);
  }

  throw new Error("Could not recover plaintext — value exceeds maxV");
}

/**
 * Poseidon(4) ciphertext hash — matches SHA256CiphertextHash in Circom.
 */
export async function hashCiphertext(balance: EncryptedBalance): Promise<string> {
  const babyjub = await buildBabyjub();
  const poseidon = await buildPoseidon();
  const F = babyjub.F;
  return poseidon.F.toString(
    poseidon([
      F.e(balance.c1.x),
      F.e(balance.c1.y),
      F.e(balance.c2.x),
      F.e(balance.c2.y),
    ]),
  );
}

export async function addCiphertext(
  left: EncryptedBalance,
  right: EncryptedBalance,
): Promise<EncryptedBalance> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const c1 = babyjub.addPoint(
    [F.fromObject(left.c1.x), F.fromObject(left.c1.y)],
    [F.fromObject(right.c1.x), F.fromObject(right.c1.y)],
  );
  const c2 = babyjub.addPoint(
    [F.fromObject(left.c2.x), F.fromObject(left.c2.y)],
    [F.fromObject(right.c2.x), F.fromObject(right.c2.y)],
  );
  return {
    c1: { x: F.toObject(c1[0]), y: F.toObject(c1[1]) },
    c2: { x: F.toObject(c2[0]), y: F.toObject(c2[1]) },
  };
}

export async function subCiphertext(
  left: EncryptedBalance,
  right: EncryptedBalance,
): Promise<EncryptedBalance> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const negRightC1 = [F.neg(F.fromObject(right.c1.x)), F.fromObject(right.c1.y)];
  const negRightC2 = [F.neg(F.fromObject(right.c2.x)), F.fromObject(right.c2.y)];
  const c1 = babyjub.addPoint(
    [F.fromObject(left.c1.x), F.fromObject(left.c1.y)],
    negRightC1,
  );
  const c2 = babyjub.addPoint(
    [F.fromObject(left.c2.x), F.fromObject(left.c2.y)],
    negRightC2,
  );
  return {
    c1: { x: F.toObject(c1[0]), y: F.toObject(c1[1]) },
    c2: { x: F.toObject(c2[0]), y: F.toObject(c2[1]) },
  };
}

export async function zeroCiphertext(): Promise<EncryptedBalance> {
  return encrypt(0n, await pkFromSecret(1n), 0n);
}

/**
 * @deprecated Use hashCiphertext instead.
 */
export function hashBalance(balance: EncryptedBalance): bigint {
  throw new Error("hashBalance is deprecated; use hashCiphertext");
}

// ─── Proof generation ────────────────────────────────────────────────────────

/**
 * Generate a Groth16 proof for the `register` circuit.
 * Returns the proof and public signals ready for the Soroban contract.
 */
export async function proveRegister(
  sk: bigint,
  wasmPath: string,
  zkeyPath: string,
  rapidsnarkBin?: string,
): Promise<Groth16Proof & { pk: JubPoint; pkHash: string; rawProof: snarkjs.Groth16Proof }> {
  const babyjub = await buildBabyjub();
  const poseidon = await buildPoseidon();
  const F = babyjub.F;

  const pkPoint = babyjub.mulPointEscalar(babyjub.Base8, sk);
  const pk: JubPoint = {
    x: F.toObject(pkPoint[0]),
    y: F.toObject(pkPoint[1]),
  };
  const pkHash = poseidon.F.toString(
    poseidon([F.e(pk.x), F.e(pk.y)])
  );

  const input = {
    sk: sk.toString(),
    pk_hash: pkHash,
  };

  const { proof, publicSignals } = await groth16Prove(input, wasmPath, zkeyPath, rapidsnarkBin);

  return {
    ...normalizeGroth16Proof(proof, publicSignals),
    pk,
    pkHash,
    rawProof: proof,
  };
}

/**
 * Generate a Groth16 proof for a private transfer.
 */
export async function proveTransfer(
  params: {
    sk_from: bigint;
    from_balance: EncryptedBalance;
    to_balance: EncryptedBalance;
    v_from_old: bigint;
    v_to_old: bigint;
    amount: bigint;
    r_s: bigint;
    r_r: bigint;
    to_pk: JubPoint;
    old_from_hash: string;
    new_from_hash: string;
    old_to_hash: string;
    new_to_hash: string;
  },
  wasmPath: string,
  zkeyPath: string,
  rapidsnarkBin?: string,
): Promise<Groth16Proof & { rawProof: snarkjs.Groth16Proof }> {
  const input = {
    sk_from:   params.sk_from.toString(),
    from_c1_x: params.from_balance.c1.x.toString(),
    from_c1_y: params.from_balance.c1.y.toString(),
    from_c2_x: params.from_balance.c2.x.toString(),
    from_c2_y: params.from_balance.c2.y.toString(),
    to_c1_x:   params.to_balance.c1.x.toString(),
    to_c1_y:   params.to_balance.c1.y.toString(),
    to_c2_x:   params.to_balance.c2.x.toString(),
    to_c2_y:   params.to_balance.c2.y.toString(),
    v_from_old: params.v_from_old.toString(),
    v_to_old:   params.v_to_old.toString(),
    amount:     params.amount.toString(),
    r_s:        params.r_s.toString(),
    r_r:        params.r_r.toString(),
    to_pk_x:    params.to_pk.x.toString(),
    to_pk_y:    params.to_pk.y.toString(),
    old_from_hash: params.old_from_hash,
    new_from_hash: params.new_from_hash,
    old_to_hash:   params.old_to_hash,
    new_to_hash:   params.new_to_hash,
  };

  const { proof, publicSignals } = await groth16Prove(input, wasmPath, zkeyPath, rapidsnarkBin);

  return {
    ...normalizeGroth16Proof(proof, publicSignals),
    rawProof: proof,
  };
}

export async function hashPublicKey(pk: JubPoint): Promise<string> {
  const babyjub = await buildBabyjub();
  const poseidon = await buildPoseidon();
  const F = babyjub.F;
  return poseidon.F.toString(poseidon([F.e(pk.x), F.e(pk.y)]));
}

export async function buildMintWitness(params: {
  amount: bigint;
  oldBalance: EncryptedBalance;
  toPk: JubPoint;
  r?: bigint;
}): Promise<{
  r: bigint;
  newBalance: EncryptedBalance;
  old_balance_hash: string;
  new_balance_hash: string;
  to_pk_hash: string;
}> {
  const babyjub = await buildBabyjub();
  const r = params.r ?? randomScalar(babyjub);
  const enc = await encrypt(params.amount, params.toPk, r);
  const newBalance = await addCiphertext(params.oldBalance, enc);

  return {
    r,
    newBalance,
    old_balance_hash: await hashCiphertext(params.oldBalance),
    new_balance_hash: await hashCiphertext(newBalance),
    to_pk_hash: await hashPublicKey(params.toPk),
  };
}

export async function proveMint(
  params: {
    amount: bigint;
    oldBalance: EncryptedBalance;
    toPk: JubPoint;
    r: bigint;
    old_balance_hash: string;
    new_balance_hash: string;
    to_pk_hash: string;
  },
  wasmPath: string,
  zkeyPath: string,
  rapidsnarkBin?: string,
): Promise<Groth16Proof & { rawProof: snarkjs.Groth16Proof; newBalance: EncryptedBalance }> {
  const enc = await encrypt(params.amount, params.toPk, params.r);
  const newBalance = await addCiphertext(params.oldBalance, enc);

  const input = {
    amount: params.amount.toString(),
    r: params.r.toString(),
    old_c1_x: params.oldBalance.c1.x.toString(),
    old_c1_y: params.oldBalance.c1.y.toString(),
    old_c2_x: params.oldBalance.c2.x.toString(),
    old_c2_y: params.oldBalance.c2.y.toString(),
    to_pk_x: params.toPk.x.toString(),
    to_pk_y: params.toPk.y.toString(),
    old_balance_hash: params.old_balance_hash,
    new_balance_hash: params.new_balance_hash,
    to_pk_hash: params.to_pk_hash,
  };

  const { proof, publicSignals } = await groth16Prove(input, wasmPath, zkeyPath, rapidsnarkBin);
  return {
    ...normalizeGroth16Proof(proof, publicSignals),
    rawProof: proof,
    newBalance,
  };
}

export async function buildDepositWitness(params: {
  amount: bigint;
  oldBalance: EncryptedBalance;
  userPk: JubPoint;
  r?: bigint;
}): Promise<{
  r: bigint;
  newBalance: EncryptedBalance;
  old_balance_hash: string;
  new_balance_hash: string;
}> {
  const babyjub = await buildBabyjub();
  const r = params.r ?? randomScalar(babyjub);
  const enc = await encrypt(params.amount, params.userPk, r);
  const newBalance = await addCiphertext(params.oldBalance, enc);

  return {
    r,
    newBalance,
    old_balance_hash: await hashCiphertext(params.oldBalance),
    new_balance_hash: await hashCiphertext(newBalance),
  };
}

export async function proveDeposit(
  params: {
    amount: bigint;
    oldBalance: EncryptedBalance;
    userPk: JubPoint;
    r: bigint;
    old_balance_hash: string;
    new_balance_hash: string;
  },
  wasmPath: string,
  zkeyPath: string,
  rapidsnarkBin?: string,
): Promise<Groth16Proof & { rawProof: snarkjs.Groth16Proof; newBalance: EncryptedBalance }> {
  const enc = await encrypt(params.amount, params.userPk, params.r);
  const newBalance = await addCiphertext(params.oldBalance, enc);

  const input = {
    amount: params.amount.toString(),
    r: params.r.toString(),
    old_c1_x: params.oldBalance.c1.x.toString(),
    old_c1_y: params.oldBalance.c1.y.toString(),
    old_c2_x: params.oldBalance.c2.x.toString(),
    old_c2_y: params.oldBalance.c2.y.toString(),
    pk_x: params.userPk.x.toString(),
    pk_y: params.userPk.y.toString(),
    old_balance_hash: params.old_balance_hash,
    new_balance_hash: params.new_balance_hash,
  };

  const { proof, publicSignals } = await groth16Prove(input, wasmPath, zkeyPath, rapidsnarkBin);
  return {
    ...normalizeGroth16Proof(proof, publicSignals),
    rawProof: proof,
    newBalance,
  };
}

export async function buildTransferWitness(params: {
  sk_from: bigint;
  from_balance: EncryptedBalance;
  to_balance: EncryptedBalance;
  v_from_old: bigint;
  v_to_old: bigint;
  amount: bigint;
  to_pk: JubPoint;
  r_s?: bigint;
  r_r?: bigint;
}): Promise<{
  r_s: bigint;
  r_r: bigint;
  new_from_balance: EncryptedBalance;
  new_to_balance: EncryptedBalance;
  old_from_hash: string;
  new_from_hash: string;
  old_to_hash: string;
  new_to_hash: string;
}> {
  const babyjub = await buildBabyjub();
  const from_pk = await pkFromSecret(params.sk_from);
  const r_s = params.r_s ?? randomScalar(babyjub);
  const r_r = params.r_r ?? randomScalar(babyjub);

  const enc_amount_sender = await encrypt(params.amount, from_pk, r_s);
  const enc_amount_receiver = await encrypt(params.amount, params.to_pk, r_r);
  const new_from_balance = await subCiphertext(params.from_balance, enc_amount_sender);
  const new_to_balance = await addCiphertext(params.to_balance, enc_amount_receiver);

  return {
    r_s,
    r_r,
    new_from_balance,
    new_to_balance,
    old_from_hash: await hashCiphertext(params.from_balance),
    new_from_hash: await hashCiphertext(new_from_balance),
    old_to_hash: await hashCiphertext(params.to_balance),
    new_to_hash: await hashCiphertext(new_to_balance),
  };
}

// ─── Soroban transaction helpers ─────────────────────────────────────────────

/**
 * Build and submit a `private_transfer` transaction.
 *
 * @param contractId  deployed EncryptedToken contract address
 * @param from        sender Stellar address
 * @param to          receiver Stellar address
 * @param proof       Groth16 transfer proof
 * @param newFromBalance  sender's new encrypted balance
 * @param newToBalance    receiver's new encrypted balance
 * @param signXdr     callback to sign the transaction XDR (use Freighter etc.)
 */
export async function submitTransfer(params: {
  contractId: string;
  from: string;
  to: string;
  proof: Groth16Proof;
  newFromBalance: EncryptedBalance;
  newToBalance: EncryptedBalance;
  signXdr: (xdr: string) => Promise<string>;
}): Promise<string> {
  const rpc = new StellarSdk.rpc.Server(TESTNET_RPC);
  const account = await rpc.getAccount(params.from);
  const contract = new StellarSdk.Contract(params.contractId);

  // Convert proof and balances to Soroban ScVal
  const proofVal = proofToScVal(params.proof);
  const pubSignalsVal = pubSignalsToScVal(params.proof.publicSignals);
  const newFromVal = balanceToScVal(params.newFromBalance);
  const newToVal = balanceToScVal(params.newToBalance);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "private_transfer",
        StellarSdk.Address.fromString(params.from).toScVal(),
        StellarSdk.Address.fromString(params.to).toScVal(),
        newFromVal,
        newToVal,
        proofVal,
        pubSignalsVal
      )
    )
    .setTimeout(180)
    .build();

  // Simulate to get resource estimates
  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }
  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();

  const signed = await params.signXdr(tx.toXDR());
  const response = await rpc.sendTransaction(
    StellarSdk.TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE) as StellarSdk.Transaction
  );

  if (response.status === "ERROR") {
    throw new Error(`Transaction error: ${JSON.stringify(response.errorResult)}`);
  }

  // Poll for confirmation
  let getResp = await rpc.getTransaction(response.hash);
  while (getResp.status === "NOT_FOUND") {
    await new Promise(res => setTimeout(res, 1000));
    getResp = await rpc.getTransaction(response.hash);
  }

  if (getResp.status !== "SUCCESS") {
    throw new Error(`Transaction failed: ${getResp.status}`);
  }

  return response.hash;
}

// ─── ScVal converters ────────────────────────────────────────────────────────

/**
 * Convert a Groth16 proof to a Soroban struct ScVal.
 * Matches the `Proof { a: G1Affine, b: G2Affine, c: G1Affine }` contract type.
 */
function proofToScVal(proof: Groth16Proof): StellarSdk.xdr.ScVal {
  const snarkProof: SnarkJsProof = {
    pi_a: proof.a,
    pi_b: proof.b,
    pi_c: proof.c,
  };
  return proofBytesToScVal(
    transformProofToSoroban(snarkProof, proof.publicSignals, proof.publicSignals.length),
  );
}

function pubSignalsToScVal(signals: string[]): StellarSdk.xdr.ScVal {
  return publicSignalBytesToScVal(signals.map(fieldElementToBytes));
}

function balanceToScVal(balance: EncryptedBalance): StellarSdk.xdr.ScVal {
  return encryptedBalanceToScVal(balance);
}
