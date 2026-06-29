import { nativeToScVal, xdr } from "@stellar/stellar-sdk";

export type Hexish = string | number | bigint;
export type SnarkJsG1 = [Hexish, Hexish, ...Hexish[]];
export type SnarkJsFq2 = [Hexish, Hexish];
export type SnarkJsG2 = [SnarkJsFq2, SnarkJsFq2, ...SnarkJsFq2[]];

export type SnarkJsVerificationKey = {
  protocol?: string;
  curve?: string;
  nPublic?: number;
  vk_alpha_1: SnarkJsG1;
  vk_beta_2: SnarkJsG2;
  vk_gamma_2: SnarkJsG2;
  vk_delta_2: SnarkJsG2;
  IC: SnarkJsG1[];
};

export type SnarkJsProof = {
  pi_a: SnarkJsG1;
  pi_b: SnarkJsG2;
  pi_c: SnarkJsG1;
};

export type SorobanProofBytes = {
  a: Uint8Array;
  b: Uint8Array;
  c: Uint8Array;
  publicSignals: Uint8Array[];
};

export type SorobanVerificationKeyBytes = {
  alpha: Uint8Array;
  beta: Uint8Array;
  gamma: Uint8Array;
  delta: Uint8Array;
  ic: Uint8Array[];
};

export function parseFieldElement(value: Hexish): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Unsafe numeric field element: ${value}`);
    }
    return BigInt(value);
  }

  const normalized = value.trim();
  if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
    return BigInt(normalized);
  }
  if (/^[0-9]+$/.test(normalized)) {
    return BigInt(normalized);
  }
  if (/^[0-9a-fA-F]+$/.test(normalized)) {
    return BigInt(`0x${normalized}`);
  }

  throw new Error(`Invalid field element: ${value}`);
}

export function fieldElementToBytes(value: Hexish): Uint8Array {
  const bigint = parseFieldElement(value);
  if (bigint < 0n) {
    throw new Error(`Field element is negative: ${String(value)}`);
  }

  let hex = bigint.toString(16);
  if (hex.length > 64) {
    throw new Error(`Field element exceeds 32 bytes: ${String(value)}`);
  }

  hex = hex.padStart(64, "0");
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function snarkJsG1ToBytes(point: SnarkJsG1): Uint8Array {
  assertArray(point, 2, "G1 point");
  return concatBytes(fieldElementToBytes(point[0]), fieldElementToBytes(point[1]));
}

export function snarkJsG2ToBytes(point: SnarkJsG2): Uint8Array {
  assertArray(point, 2, "G2 point");

  return concatBytes(
    snarkJsFq2ToNativeBytes(point[0]),
    snarkJsFq2ToNativeBytes(point[1]),
  );
}

export function transformProofToSoroban(
  proof: SnarkJsProof,
  publicSignals: Hexish[],
  expectedPublicSignals = 3,
): SorobanProofBytes {
  if (publicSignals.length !== expectedPublicSignals) {
    throw new Error(
      `Expected ${expectedPublicSignals} public signals, got ${publicSignals.length}`,
    );
  }

  return {
    a: snarkJsG1ToBytes(proof.pi_a),
    b: snarkJsG2ToBytes(proof.pi_b),
    c: snarkJsG1ToBytes(proof.pi_c),
    publicSignals: publicSignals.map(fieldElementToBytes),
  };
}

export function verificationKeyToBytes(vk: SnarkJsVerificationKey): SorobanVerificationKeyBytes {
  if (vk.protocol && vk.protocol !== "groth16") {
    throw new Error(`Expected Groth16 VK, got protocol=${vk.protocol}`);
  }
  if (vk.curve && !["bn128", "bn254"].includes(vk.curve.toLowerCase())) {
    throw new Error(`Expected BN254/bn128 VK, got curve=${vk.curve}`);
  }
  assertArray(vk.IC, 1, "IC array");

  return {
    alpha: snarkJsG1ToBytes(vk.vk_alpha_1),
    beta: snarkJsG2ToBytes(vk.vk_beta_2),
    gamma: snarkJsG2ToBytes(vk.vk_gamma_2),
    delta: snarkJsG2ToBytes(vk.vk_delta_2),
    ic: vk.IC.map(snarkJsG1ToBytes),
  };
}

export function proofBytesToScVal(proof: SorobanProofBytes): xdr.ScVal {
  return scStruct({
    a: g1BytesToScVal(proof.a),
    b: g2BytesToScVal(proof.b),
    c: g1BytesToScVal(proof.c),
  });
}

export function publicSignalsToScVal(publicSignals: Uint8Array[]): xdr.ScVal {
  return scVec(publicSignals.map(scBytes));
}

export function verificationKeyBytesToScVal(vk: SorobanVerificationKeyBytes): xdr.ScVal {
  return scStruct({
    alpha: g1BytesToScVal(vk.alpha),
    beta: g2BytesToScVal(vk.beta),
    gamma: g2BytesToScVal(vk.gamma),
    delta: g2BytesToScVal(vk.delta),
    ic: scVec(vk.ic.map(g1BytesToScVal)),
  });
}

export function verificationKeyToScVal(vk: SnarkJsVerificationKey): xdr.ScVal {
  return verificationKeyBytesToScVal(verificationKeyToBytes(vk));
}

export function jubJubPointToScVal(point: { x: Hexish; y: Hexish }): xdr.ScVal {
  return scStruct({
    x: scBytes(fieldElementToBytes(point.x)),
    y: scBytes(fieldElementToBytes(point.y)),
  });
}

export function encryptedBalanceToScVal(balance: {
  c1: { x: Hexish; y: Hexish };
  c2: { x: Hexish; y: Hexish };
}): xdr.ScVal {
  return scStruct({
    c1: jubJubPointToScVal(balance.c1),
    c2: jubJubPointToScVal(balance.c2),
  });
}

export function g1BytesToScVal(bytes: Uint8Array): xdr.ScVal {
  assertByteLength(bytes, 64, "G1 bytes");
  return scStruct({
    x: scBytes(bytes.subarray(0, 32)),
    y: scBytes(bytes.subarray(32, 64)),
  });
}

export function g2BytesToScVal(bytes: Uint8Array): xdr.ScVal {
  assertByteLength(bytes, 128, "G2 bytes");
  return scStruct({
    x: scStruct({
      c0: scBytes(bytes.subarray(32, 64)),
      c1: scBytes(bytes.subarray(0, 32)),
    }),
    y: scStruct({
      c0: scBytes(bytes.subarray(96, 128)),
      c1: scBytes(bytes.subarray(64, 96)),
    }),
  });
}

export function bytesToHex(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function scSymbol(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "symbol" });
}

export function scBytes(value: Uint8Array): xdr.ScVal {
  return nativeToScVal(value, { type: "bytes" });
}

export function scVec(values: xdr.ScVal[]): xdr.ScVal {
  return nativeToScVal(values);
}

export function scStruct(entries: Record<string, xdr.ScVal>): xdr.ScVal {
  const type: Record<string, ["symbol", null]> = {};
  for (const key of Object.keys(entries)) {
    type[key] = ["symbol", null];
  }
  return nativeToScVal(entries, { type });
}

function snarkJsFq2ToNativeBytes(pair: SnarkJsFq2): Uint8Array {
  assertArray(pair, 2, "Fq2 element");

  // snarkjs/circom JSON stores Fq2 as [c0, c1]; Soroban native encoding is c1 || c0.
  return concatBytes(fieldElementToBytes(pair[1]), fieldElementToBytes(pair[0]));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function assertArray(value: unknown, minLength: number, label: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new Error(`Invalid ${label}: expected array length >= ${minLength}`);
  }
}

function assertByteLength(value: Uint8Array, length: number, label: string): void {
  if (value.length !== length) {
    throw new Error(`Invalid ${label}: expected ${length} bytes, got ${value.length}`);
  }
}
