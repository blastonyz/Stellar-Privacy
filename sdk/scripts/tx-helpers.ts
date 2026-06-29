import "./bootstrap-env.js";
import {
  Account,  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { fetchHorizonJson } from "./stellar-fetch.js";
export type TxEnv = {
  server: rpc.Server;
  signer: Keypair;
  networkPassphrase: string;
  horizonUrl: string;
  timeoutSeconds: number;
};

export async function simulateContractView(
  env: TxEnv,
  contractId: string,
  fn: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const contract = new Contract(contractId);
  const source = await getSourceAccount(env);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.networkPassphrase,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(env.timeoutSeconds)
    .build();

  const simulation = await env.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`View simulation failed for ${fn}: ${simulation.error}`);
  }
  if (!simulation.result?.retval) {
    throw new Error(`View ${fn} returned no value`);
  }
  return scValToNative(simulation.result.retval);
}

export async function isRegistered(
  env: TxEnv,
  contractId: string,
  userAddress: string,
): Promise<boolean> {
  const result = await simulateContractView(env, contractId, "is_registered", [
    Address.fromString(userAddress).toScVal(),
  ]);
  return result === true;
}

export function isAlreadyRegisteredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /AlreadyRegistered|Error\(Contract, #3\)|error #3/i.test(message);
}

export function isTlsVerificationError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      if (
        code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        code === "CERT_HAS_EXPIRED" ||
        /unable to verify the first certificate/i.test(current.message)
      ) {
        return true;
      }
      current = current.cause;
    } else {
      break;
    }
  }
  return false;
}

export function tlsHelpMessage(): string {
  return (
    "TLS certificate verification failed when calling Stellar RPC/Horizon. " +
    "For local dev, set NODE_TLS_REJECT_UNAUTHORIZED=0 in .env or run via `make`."
  );
}

export async function buildAndSimulate(
  env: TxEnv,
  operation: xdr.Operation,
): Promise<any> {
  const source = await getSourceAccount(env);
  const baseTx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(env.timeoutSeconds)
    .build();

  const simulation = await env.server.simulateTransaction(baseTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  return rpc.assembleTransaction(baseTx, simulation).build();
}

export async function getSourceAccount(env: TxEnv): Promise<Account> {
  try {
    return await env.server.getAccount(env.signer.publicKey());
  } catch (error) {
    try {
      const account = await fetchHorizonJson(
        `${env.horizonUrl}/accounts/${env.signer.publicKey()}`,
      ) as { account_id: string; sequence: string };
      return new Account(account.account_id, account.sequence);
    } catch (fetchError) {
      if (isTlsVerificationError(fetchError)) {
        throw new Error(tlsHelpMessage(), { cause: fetchError });
      }
      throw fetchError;
    }
  }
}

export async function submit(env: TxEnv, tx: any): Promise<rpc.Api.SendTransactionResponse> {
  tx.sign(env.signer);
  const sent = await env.server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(sent.errorResult)}`);
  }
  return sent;
}

export async function waitForTransaction(
  env: TxEnv,
  hash: string,
  label: string,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await env.server.getTransaction(hash);
    if (result.status === "SUCCESS") {
      console.log(`${label}: confirmed ${hash}`);
      return result;
    }
    if (result.status === "FAILED") {
      throw new Error(`${label}: transaction failed ${hash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${label}: timed out waiting for ${hash}`);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function runScript(main: () => Promise<void>): void {
  void main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
