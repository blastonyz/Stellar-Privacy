import {
  Address,
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  nativeToEncryptedBalance,
  nativeToJubPoint,
  type EncryptedBalance,
  type JubPoint,
} from "../lib/client.js";
import { assertContractConfigured, config } from "../config.js";
import { formatSimulationError } from "../lib/simulation-errors.js";

const server = new rpc.Server(config.rpcUrl);

export async function getAccount(publicKey: string) {
  return server.getAccount(publicKey);
}

export async function simulateView(
  publicKey: string,
  fn: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  assertContractConfigured();
  const contract = new Contract(config.contractId);
  const account = await getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(config.txTimeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`View simulation failed for ${fn}: ${formatSimulationError(simulation.error)}`);
  }
  if (!simulation.result?.retval) {
    throw new Error(`View ${fn} returned no value`);
  }
  return scValToNative(simulation.result.retval);
}

export async function buildUnsignedTx(publicKey: string, operation: xdr.Operation): Promise<string> {
  const account = await getAccount(publicKey);
  const baseTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(config.txTimeoutSeconds)
    .build();

  const simulation = await server.simulateTransaction(baseTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${formatSimulationError(simulation.error)}`);
  }
  return rpc.assembleTransaction(baseTx, simulation).build().toXDR();
}

export async function fetchIsRegistered(caller: string, user: string): Promise<boolean> {
  const result = await simulateView(caller, "is_registered", [Address.fromString(user).toScVal()]);
  return result === true;
}

export async function fetchUserPk(caller: string, user: string): Promise<JubPoint> {
  const registered = await fetchIsRegistered(caller, user);
  if (!registered) {
    throw new Error(`User ${user} is not registered`);
  }
  const pk = await simulateView(caller, "get_user_pk", [Address.fromString(user).toScVal()]);
  return nativeToJubPoint(pk);
}

export async function fetchEncryptedBalance(caller: string, user: string): Promise<EncryptedBalance> {
  const balance = await simulateView(caller, "get_balance", [Address.fromString(user).toScVal()]);
  if (!balance) {
    throw new Error(`No encrypted balance for ${user}`);
  }
  return nativeToEncryptedBalance(balance);
}

export function tokenContract(): Contract {
  assertContractConfigured();
  return new Contract(config.contractId);
}

export { server as rpcServer };
