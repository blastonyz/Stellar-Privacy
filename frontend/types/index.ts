export type NavSection =
  | "dashboard"
  | "transfer"
  | "deposit"
  | "mint"
  | "balances"
  | "compliance";

export type ProofStatus = "ZK-Verified" | "Generating Client-side Proof" | "Pending";

export type ActivityRow = {
  id: string;
  timestamp: string;
  counterparty: string;
  amountLabel: string;
  proofStatus: ProofStatus;
};

export type AssetAccount = {
  id: string;
  asset: string;
  network: string;
  balance: number | string;
  currency: string;
  visible: boolean;
};

export type PublicInputs = {
  old_from_hash: string;
  new_from_hash: string;
  old_to_hash: string;
  new_to_hash: string;
};

export type ProofSnapshot = {
  constraintsChecked: number;
  constraintsTotal: number;
  circuitVkId: string;
  publicInputs: PublicInputs;
};

export type EncryptedBalanceOnChain = {
  c1: { x: Buffer | Uint8Array; y: Buffer | Uint8Array };
  c2: { x: Buffer | Uint8Array; y: Buffer | Uint8Array };
};

export type ContractEvent = {
  id: string;
  ledger: number;
  txHash: string;
  kind: string;
  topics: unknown[];
  value: unknown;
};

export type ShieldAccountState = {
  registered: boolean;
  encryptedBalance: EncryptedBalanceOnChain | null;
  decryptedBalance: string | null;
  babyJubSk: string | null;
};
