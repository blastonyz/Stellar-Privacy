import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

export type FieldBytes = Buffer;

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





export interface Proof {
  a: BN254G1;
  b: BN254G2;
  c: BN254G1;
}


export interface BN254G1 {
  x: FieldBytes;
  y: FieldBytes;
}


export interface BN254G2 {
  x: BN254Fq2;
  y: BN254Fq2;
}


export interface BN254Fq2 {
  c0: FieldBytes;
  c1: FieldBytes;
}


export interface VerificationKey {
  alpha: BN254G1;
  beta: BN254G2;
  delta: BN254G2;
  gamma: BN254G2;
  ic: Array<BN254G1>;
}

export interface Client {
  /**
   * Construct and simulate a verify transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify: ({vk, proof, pub_signals}: {vk: VerificationKey, proof: Proof, pub_signals: Array<FieldBytes>}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAB9AAAAAHQk4yNTRHMQAAAAAAAAAAAWIAAAAAAAfQAAAAB0JOMjU0RzIAAAAAAAAAAAFjAAAAAAAH0AAAAAdCTjI1NEcxAA==",
        "AAAAAQAAAAAAAAAAAAAAB0JOMjU0RzEAAAAAAgAAAAAAAAABeAAAAAAAB9AAAAAKRmllbGRCeXRlcwAAAAAAAAAAAAF5AAAAAAAH0AAAAApGaWVsZEJ5dGVzAAA=",
        "AAAAAQAAAAAAAAAAAAAAB0JOMjU0RzIAAAAAAgAAAAAAAAABeAAAAAAAB9AAAAAIQk4yNTRGcTIAAAAAAAAAAXkAAAAAAAfQAAAACEJOMjU0RnEy",
        "AAAAAQAAAAAAAAAAAAAACEJOMjU0RnEyAAAAAgAAAAAAAAACYzAAAAAAB9AAAAAKRmllbGRCeXRlcwAAAAAAAAAAAAJjMQAAAAAH0AAAAApGaWVsZEJ5dGVzAAA=",
        "AAAAAAAAAAAAAAAGdmVyaWZ5AAAAAAADAAAAAAAAAAJ2awAAAAAH0AAAAA9WZXJpZmljYXRpb25LZXkAAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAFUHJvb2YAAAAAAAAAAAAAC3B1Yl9zaWduYWxzAAAAA+oAAAfQAAAACkZpZWxkQnl0ZXMAAAAAAAEAAAAB",
        "AAAAAQAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQAAAAAFAAAAAAAAAAVhbHBoYQAAAAAAB9AAAAAHQk4yNTRHMQAAAAAAAAAABGJldGEAAAfQAAAAB0JOMjU0RzIAAAAAAAAAAAVkZWx0YQAAAAAAB9AAAAAHQk4yNTRHMgAAAAAAAAAABWdhbW1hAAAAAAAH0AAAAAdCTjI1NEcyAAAAAAAAAAACaWMAAAAAA+oAAAfQAAAAB0JOMjU0RzEA" ]),
      options
    )
  }
  public readonly fromJSON = {
    verify: this.txFromJSON<boolean>
  }
}