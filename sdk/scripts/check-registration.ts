import "./bootstrap-env.js";
import path from "node:path";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  scValToNative,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import { getSourceAccount, runScript, type TxEnv } from "./tx-helpers.js";

async function main(): Promise<void> {
  const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
  const target = process.argv[2] ?? "receptor";
  const {
    RPC_URL = "https://soroban-testnet.stellar.org",
    HORIZON_URL = "https://horizon-testnet.stellar.org",
    NETWORK_PASSPHRASE = Networks.TESTNET,
    SECRET_KEY,
    RECEPTOR_SECRET_KEY,
    ENCRYPTED_TOKEN_CONTRACT_ID,
    TEST_RECEPTOR_ADDRESS,
  } = process.env;

  if (!SECRET_KEY || !ENCRYPTED_TOKEN_CONTRACT_ID) {
    throw new Error("Missing SECRET_KEY or ENCRYPTED_TOKEN_CONTRACT_ID");
  }

  const user =
    target === "owner"
      ? Keypair.fromSecret(SECRET_KEY).publicKey()
      : RECEPTOR_SECRET_KEY
        ? Keypair.fromSecret(RECEPTOR_SECRET_KEY).publicKey()
        : TEST_RECEPTOR_ADDRESS;

  if (!user) {
    throw new Error("Missing TEST_RECEPTOR_ADDRESS for receptor check");
  }

  const txEnv: TxEnv = {
    server: new rpc.Server(RPC_URL),
    signer: Keypair.fromSecret(SECRET_KEY),
    networkPassphrase: NETWORK_PASSPHRASE,
    horizonUrl: HORIZON_URL,
    timeoutSeconds: 180,
  };

  const token = new Contract(ENCRYPTED_TOKEN_CONTRACT_ID);
  const source = await getSourceAccount(txEnv);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      token.call("is_registered", Address.fromString(user).toScVal()),
    )
    .setTimeout(180)
    .build();

  const simulation = await txEnv.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  const registered = scValToNative(simulation.result!.retval);
  console.log(`${user} is_registered=${registered}`);
}

runScript(main);
