import {
  Address,
  Contract,
  Keypair,
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

export function isAlreadyRegisteredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /AlreadyRegistered|Error\(Contract, #3\)|error #3/i.test(message);
}

export async function signAndSubmitFromSecret(
  secretKey: string,
  unsignedXdr: string,
): Promise<{ hash: string }> {
  const keypair = Keypair.fromSecret(secretKey);
  const tx = TransactionBuilder.fromXDR(unsignedXdr, config.networkPassphrase);
  tx.sign(keypair);

  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(sent.errorResult)}`);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await server.getTransaction(sent.hash);
    if (result.status === "SUCCESS") {
      return { hash: sent.hash };
    }
    if (result.status === "FAILED") {
      throw new Error(`Transaction failed on-chain: ${sent.hash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for transaction ${sent.hash}`);
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
  const balance = await fetchEncryptedBalanceOptional(caller, user);
  if (!balance) {
    throw new Error(`No encrypted balance for ${user}`);
  }
  return balance;
}

export async function fetchEncryptedBalanceOptional(
  caller: string,
  user: string,
): Promise<EncryptedBalance | null> {
  const balance = await simulateView(caller, "get_balance", [Address.fromString(user).toScVal()]);
  if (!balance) {
    return null;
  }
  return nativeToEncryptedBalance(balance);
}

export function tokenContract(): Contract {
  assertContractConfigured();
  return new Contract(config.contractId);
}

export { server as rpcServer };
