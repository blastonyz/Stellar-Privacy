import { Address, Contract, rpc, TransactionBuilder, BASE_FEE, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { assertContractConfigured, config } from "../config.js";
import { getAccount } from "./stellar.js";

/** Probe whether the deployed token WASM exposes `deposit` (vs stale deployment). */
export async function probeDepositSupported(callerPublicKey: string): Promise<boolean> {
  assertContractConfigured();
  const contract = new Contract(config.contractId);
  const account = await getAccount(callerPublicKey);
  const server = new rpc.Server(config.rpcUrl);

  const zero = Buffer.alloc(32);
  const dummyBalance = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("c1"),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("x"), val: xdr.ScVal.scvBytes(zero) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("y"), val: xdr.ScVal.scvBytes(zero) }),
      ]),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("c2"),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("x"), val: xdr.ScVal.scvBytes(zero) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("y"), val: xdr.ScVal.scvBytes(zero) }),
      ]),
    }),
  ]);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "deposit",
        Address.fromString(callerPublicKey).toScVal(),
        nativeToScVal(1n, { type: "i128" }),
        dummyBalance,
        dummyBalance,
        xdr.ScVal.scvVec([]),
      ),
    )
    .setTimeout(config.txTimeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationError(simulation)) {
    return true;
  }

  const err = simulation.error ?? "";
  return !(
    err.includes("non-existent contract function") &&
    err.includes("deposit")
  );
}

export async function getContractFeatures(callerPublicKey?: string): Promise<{ deposit: boolean }> {
  if (!config.contractId || !callerPublicKey) {
    return { deposit: false };
  }
  try {
    const deposit = await probeDepositSupported(callerPublicKey);
    return { deposit };
  } catch {
    return { deposit: false };
  }
}
