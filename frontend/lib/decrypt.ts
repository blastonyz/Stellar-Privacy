import { Buffer } from "buffer";
import { buildBabyjub } from "circomlibjs";
import type { EncryptedBalanceOnChain } from "@/types";

function fieldBytesToBigInt(value: Buffer | Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(value).toString("hex")}`);
}

function toEncryptedBalance(balance: EncryptedBalanceOnChain) {
  return {
    c1: {
      x: fieldBytesToBigInt(balance.c1.x),
      y: fieldBytesToBigInt(balance.c1.y),
    },
    c2: {
      x: fieldBytesToBigInt(balance.c2.x),
      y: fieldBytesToBigInt(balance.c2.y),
    },
  };
}

async function babyStepGiantStep(
  babyjub: Awaited<ReturnType<typeof buildBabyjub>>,
  target: [unknown, unknown],
  maxV: bigint,
): Promise<bigint> {
  const F = babyjub.F;
  const sqrtMax = BigInt(Math.ceil(Math.sqrt(Number(maxV))));
  const table = new Map<string, bigint>();
  let baby: [unknown, unknown] = [F.zero, F.one];

  for (let i = 0n; i <= sqrtMax; i++) {
    const key = `${F.toObject(baby[0])},${F.toObject(baby[1])}`;
    if (!table.has(key)) table.set(key, i);
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
 * Decrypt a Twisted ElGamal balance locally using the view key (BabyJub sk).
 * Never sends the secret key over the network.
 */
export async function decryptBalanceLocal(
  encryptedBalance: EncryptedBalanceOnChain,
  viewKeySk: string,
  maxBalance = 2n ** 32n,
): Promise<string> {
  const babyjub = await buildBabyjub();
  const F = babyjub.F;
  const sk = BigInt(viewKeySk);
  const balance = toEncryptedBalance(encryptedBalance);

  const c1 = [F.fromObject(balance.c1.x), F.fromObject(balance.c1.y)];
  const c2 = [F.fromObject(balance.c2.x), F.fromObject(balance.c2.y)];
  const skC1 = babyjub.mulPointEscalar(c1, sk);
  const negSkC1Point = [F.neg(skC1[0]), skC1[1]];
  const vG = babyjub.addPoint(c2, negSkC1Point);

  const plaintext = await babyStepGiantStep(babyjub, vG, maxBalance);
  return plaintext.toString();
}
