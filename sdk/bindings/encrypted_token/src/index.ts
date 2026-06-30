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




export const Errors = {
  1: {message:"Unauthorized"},
  2: {message:"NotRegistered"},
  3: {message:"AlreadyRegistered"},
  4: {message:"InvalidProof"},
  5: {message:"BadPublicSignals"},
  8: {message:"MissingVk"},
  9: {message:"BalanceMismatch"}
}


export interface Proof {
  a: BN254G1;
  b: BN254G2;
  c: BN254G1;
}

export type OpType = {tag: "Register", values: void} | {tag: "Mint", values: void} | {tag: "Transfer", values: void} | {tag: "Deposit", values: void} | {tag: "Withdraw", values: void};


export interface BN254G1 {
  x: FieldBytes;
  y: FieldBytes;
}


export interface BN254G2 {
  x: BN254Fq2;
  y: BN254Fq2;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Verifier", values: void} | {tag: "Vk", values: readonly [OpType]} | {tag: "UserPk", values: readonly [string]} | {tag: "Balance", values: readonly [string]} | {tag: "Registered", values: readonly [string]};


export interface BN254Fq2 {
  c0: FieldBytes;
  c1: FieldBytes;
}


export interface JubJubPoint {
  x: FieldBytes;
  y: FieldBytes;
}


export interface VerificationKey {
  alpha: BN254G1;
  beta: BN254G2;
  delta: BN254G2;
  gamma: BN254G2;
  ic: Array<BN254G1>;
}


export interface EncryptedBalance {
  c1: JubJubPoint;
  c2: JubJubPoint;
}





export interface Client {
  /**
   * Construct and simulate a set_vk transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_vk: ({op, vk}: {op: OpType, vk: VerificationKey}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register: ({user, user_pk, proof, pub_signals}: {user: string, user_pk: JubJubPoint, proof: Proof, pub_signals: Array<FieldBytes>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_balance: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<EncryptedBalance>>>

  /**
   * Construct and simulate a get_user_pk transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_pk: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<JubJubPoint>>>

  /**
   * Construct and simulate a private_mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  private_mint: ({to, new_balance, proof, pub_signals}: {to: string, new_balance: EncryptedBalance, proof: Proof, pub_signals: Array<FieldBytes>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_registered transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_registered: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a private_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  private_transfer: ({from, to, new_from_balance, new_to_balance, proof, pub_signals}: {from: string, to: string, new_from_balance: EncryptedBalance, new_to_balance: EncryptedBalance, proof: Proof, pub_signals: Array<FieldBytes>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, verifier}: {admin: string, verifier: string},
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
    return ContractClient.deploy({admin, verifier}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABwAAAAAAAAAMVW5hdXRob3JpemVkAAAAAQAAAAAAAAANTm90UmVnaXN0ZXJlZAAAAAAAAAIAAAAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAAwAAAAAAAAAMSW52YWxpZFByb29mAAAABAAAAAAAAAAQQmFkUHVibGljU2lnbmFscwAAAAUAAAAAAAAACU1pc3NpbmdWawAAAAAAAAgAAAAAAAAAD0JhbGFuY2VNaXNtYXRjaAAAAAAJ",
        "AAAAAQAAAAAAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAB9AAAAAHQk4yNTRHMQAAAAAAAAAAAWIAAAAAAAfQAAAAB0JOMjU0RzIAAAAAAAAAAAFjAAAAAAAH0AAAAAdCTjI1NEcxAA==",
        "AAAAAgAAAAAAAAAAAAAABk9wVHlwZQAAAAAABQAAAAAAAAAAAAAACFJlZ2lzdGVyAAAAAAAAAAAAAAAETWludAAAAAAAAAAAAAAACFRyYW5zZmVyAAAAAAAAAAAAAAAHRGVwb3NpdAAAAAAAAAAAAAAAAAhXaXRoZHJhdw==",
        "AAAAAQAAAAAAAAAAAAAAB0JOMjU0RzEAAAAAAgAAAAAAAAABeAAAAAAAB9AAAAAKRmllbGRCeXRlcwAAAAAAAAAAAAF5AAAAAAAH0AAAAApGaWVsZEJ5dGVzAAA=",
        "AAAAAQAAAAAAAAAAAAAAB0JOMjU0RzIAAAAAAgAAAAAAAAABeAAAAAAAB9AAAAAIQk4yNTRGcTIAAAAAAAAAAXkAAAAAAAfQAAAACEJOMjU0RnEy",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAIVmVyaWZpZXIAAAABAAAAAAAAAAJWawAAAAAAAQAAB9AAAAAGT3BUeXBlAAAAAAABAAAAAAAAAAZVc2VyUGsAAAAAAAEAAAATAAAAAQAAAAAAAAAHQmFsYW5jZQAAAAABAAAAEwAAAAEAAAAAAAAAClJlZ2lzdGVyZWQAAAAAAAEAAAAT",
        "AAAAAQAAAAAAAAAAAAAACEJOMjU0RnEyAAAAAgAAAAAAAAACYzAAAAAAB9AAAAAKRmllbGRCeXRlcwAAAAAAAAAAAAJjMQAAAAAH0AAAAApGaWVsZEJ5dGVzAAA=",
        "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" ]),
      options
    )
  }
  public readonly fromJSON = {
    set_vk: this.txFromJSON<null>,
        register: this.txFromJSON<Result<void>>,
        get_balance: this.txFromJSON<Option<EncryptedBalance>>,
        get_user_pk: this.txFromJSON<Option<JubJubPoint>>,
        private_mint: this.txFromJSON<Result<void>>,
        is_registered: this.txFromJSON<boolean>,
        private_transfer: this.txFromJSON<Result<void>>
  }
}