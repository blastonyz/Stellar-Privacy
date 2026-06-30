import { Buffer } from "buffer";
import {
  Address,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { assertContractConfigured, rpc as rpcServer, stellarConfig } from "@/lib/stellar";
import type { EncryptedBalanceOnChain, PublicInputs } from "@/types";

export async function simulateContractView(
  publicKey: string,
  fn: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  assertContractConfigured();
  const contract = new Contract(stellarConfig.contractId);
  const account = await rpcServer.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: stellarConfig.networkPassphrase,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(180)
    .build();

  const simulation = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed for ${fn}: ${simulation.error}`);
  }
  if (!simulation.result?.retval) {
    throw new Error(`View ${fn} returned no value`);
  }
  return scValToNative(simulation.result.retval);
}

export async function fetchIsRegistered(
  publicKey: string,
  userAddress: string,
): Promise<boolean> {
  const result = await simulateContractView(publicKey, "is_registered", [
    Address.fromString(userAddress).toScVal(),
  ]);
  return result === true;
}

export async function fetchEncryptedBalance(
  publicKey: string,
  userAddress: string,
): Promise<EncryptedBalanceOnChain | null> {
  const result = await simulateContractView(publicKey, "get_balance", [
    Address.fromString(userAddress).toScVal(),
  ]);
  if (!result) return null;
  return result as EncryptedBalanceOnChain;
}

export async function fetchContractEvents(limit = 20) {
  assertContractConfigured();
  const latest = await rpcServer.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - 5000);

  const response = await rpcServer.getEvents({
    startLedger,
    endLedger: latest.sequence,
    filters: [
      {
        type: "contract",
        contractIds: [stellarConfig.contractId],
      },
    ],
    limit,
  });

  return response.events.map((event) => {
    const topics = event.topic.map((topic) => scValToNative(topic));
    let value: unknown;
    try {
      value = scValToNative(event.value);
    } catch {
      value = event.value.toXDR("base64");
    }
    return {
      id: event.id,
      ledger: event.ledger,
      txHash: event.txHash,
      kind: String(topics[1] ?? topics[0] ?? "unknown"),
      topics,
      value,
    };
  });
}

export function extractPublicInputs(events: Awaited<ReturnType<typeof fetchContractEvents>>): PublicInputs | null {
  const transfer = events.find((event) => event.kind === "xfer");
  if (!transfer || !transfer.value || typeof transfer.value !== "object") {
    return null;
  }

  const value = transfer.value as Record<string, unknown>;
  const toHex = (input: unknown) => {
    if (typeof input === "string") return input;
    if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
      return `0x${Buffer.from(input).toString("hex")}`;
    }
    return String(input);
  };

  return {
    old_from_hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    new_from_hash: toHex(value.new_from_hash),
    old_to_hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    new_to_hash: toHex(value.new_to_hash),
  };
}

export { loadBabyJubSecret, saveBabyJubSecret } from "@/lib/keys/view-key-store";
export const BABYJUB_STORAGE_PREFIX = "shield-babyjub-sk:";
