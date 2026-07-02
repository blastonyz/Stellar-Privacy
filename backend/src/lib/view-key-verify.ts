import { pkFromSecret } from "./client.js";
import type { StoredRegisterState } from "./register-state-store.js";

export type JubPoint = { x: bigint; y: bigint };

export function jubPointsEqual(a: JubPoint, b: JubPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function storedPkToJubPoint(pk: { x: string; y: string }): JubPoint {
  return { x: BigInt(pk.x), y: BigInt(pk.y) };
}

export async function pkFromViewKeySk(sk: string): Promise<JubPoint> {
  return pkFromSecret(BigInt(sk));
}

/** True when stored register state matches the user's on-chain BabyJub public key. */
export function storedStateMatchesOnChainPk(
  state: StoredRegisterState,
  onChainPk: JubPoint,
): boolean {
  return jubPointsEqual(storedPkToJubPoint(state.pk), onChainPk);
}

export async function viewKeySkMatchesOnChainPk(sk: string, onChainPk: JubPoint): Promise<boolean> {
  const derived = await pkFromViewKeySk(sk);
  return jubPointsEqual(derived, onChainPk);
}
