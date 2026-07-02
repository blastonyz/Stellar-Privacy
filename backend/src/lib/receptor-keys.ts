import fs from "node:fs";
import { circuitPath } from "../config.js";
import { readRegisterState as readPersistedRegisterState } from "./register-state-store.js";

export type RegisterState = {
  stellarAddress?: string;
  sk: string;
  pk?: { x: string; y: string };
  pkHash?: string;
};

function readCircuitRegisterState(filename: string): RegisterState | null {
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

export async function readCounterpartyRegisterState(address: string): Promise<RegisterState | null> {
  for (const filename of ["state-receptor.json", "state.json"]) {
    const state = readCircuitRegisterState(filename);
    if (state?.sk && (!state.stellarAddress || state.stellarAddress === address)) {
      return state;
    }
  }

  const persisted = await readPersistedRegisterState(address);
  if (persisted?.sk) {
    return {
      stellarAddress: persisted.stellarAddress,
      sk: persisted.sk,
      pk: persisted.pk,
      pkHash: persisted.pkHash,
    };
  }

  return null;
}

/** Demo / dev fallback: resolve a counterparty view key from env or persisted register state. */
export async function resolveReceiverViewKey(
  receiverAddress: string,
  provided?: string,
): Promise<string | undefined> {
  if (provided) {
    return provided;
  }

  const testReceptor = process.env.TEST_RECEPTOR_ADDRESS;
  if (testReceptor && receiverAddress === testReceptor && process.env.RECEPTOR_BABYJUB_SK) {
    return process.env.RECEPTOR_BABYJUB_SK;
  }

  const state = await readCounterpartyRegisterState(receiverAddress);
  return state?.sk;
}
