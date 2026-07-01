import fs from "node:fs";
import { circuitPath } from "../config.js";

export type RegisterState = {
  stellarAddress?: string;
  sk: string;
  pk?: { x: string; y: string };
  pkHash?: string;
};

function readRegisterState(filename: string): RegisterState | null {
  const statePath = circuitPath("register", filename);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8")) as RegisterState;
  } catch {
    return null;
  }
}

export function readCounterpartyRegisterState(address: string): RegisterState | null {
  for (const filename of ["state-receptor.json", "state.json"]) {
    const state = readRegisterState(filename);
    if (state?.sk && (!state.stellarAddress || state.stellarAddress === address)) {
      return state;
    }
  }
  return null;
}

/** Demo / dev fallback: resolve a counterparty view key from env or local register state. */
export function resolveReceiverViewKey(
  receiverAddress: string,
  provided?: string,
): string | undefined {
  if (provided) {
    return provided;
  }

  const testReceptor = process.env.TEST_RECEPTOR_ADDRESS;
  if (testReceptor && receiverAddress === testReceptor && process.env.RECEPTOR_BABYJUB_SK) {
    return process.env.RECEPTOR_BABYJUB_SK;
  }

  const state = readCounterpartyRegisterState(receiverAddress);
  return state?.sk;
}
