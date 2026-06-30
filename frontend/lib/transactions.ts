import {
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import { rpc as rpcServer, stellarConfig } from "@/lib/stellar";

export async function submitSignedTransaction(signedXdr: string) {
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    stellarConfig.networkPassphrase,
  );

  const response = await rpcServer.sendTransaction(transaction);
  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
  }

  let result = await rpcServer.getTransaction(response.hash);
  for (let attempt = 0; attempt < 60 && result.status === "NOT_FOUND"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    result = await rpcServer.getTransaction(response.hash);
  }

  if (result.status === "SUCCESS") {
    return { hash: response.hash, status: result.status };
  }

  throw new Error(`Transaction ${response.hash} ended with status ${result.status}`);
}

export async function signAndSubmit(
  unsignedXdr: string,
  sign: (xdr: string) => Promise<string>,
) {
  const signedXdr = await sign(unsignedXdr);
  return submitSignedTransaction(signedXdr);
}
