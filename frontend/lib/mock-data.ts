import type { ActivityRow, AssetAccount, ProofSnapshot } from "@/types";

export const MOCK_WALLET = "GD3V8K2R9M4N7P1Q5T6U8W0X2Y4Z6A8B0C2D4E6F8G0H2J4K6L8M0N2P4Z2R";

export const MOCK_STATS = {
  shieldedValue: 2847500,
  pendingVerifications: 2,
  lastTxStatus: "Verified" as const,
};

export const MOCK_ACTIVITY: ActivityRow[] = [
  {
    id: "act-001",
    timestamp: "2026-06-30T13:42:00Z",
    counterparty: "GD4RG67NYD3TZKYJHNYXJDZXLXEFLKLJC3K3JC75RZGC5NDCKELX2I3O",
    amountLabel: "Encrypted via Twisted ElGamal / BN254",
    proofStatus: "ZK-Verified",
  },
  {
    id: "act-002",
    timestamp: "2026-06-30T11:18:00Z",
    counterparty: "GBT7NTJIOY6UCYDTNBW4K57EF5KYRS3QGHGDTWQB4LJJV367DVIOJVY7",
    amountLabel: "Encrypted via Twisted ElGamal / BN254",
    proofStatus: "ZK-Verified",
  },
  {
    id: "act-003",
    timestamp: "2026-06-30T09:05:00Z",
    counterparty: "GCX3F9K2M8N1P4Q7R0T3U6V9W2X5Y8Z1A4B7C0D3E6F9G2H5J8K1L4M7N0P3",
    amountLabel: "Encrypted via Twisted ElGamal / BN254",
    proofStatus: "Generating Client-side Proof",
  },
  {
    id: "act-004",
    timestamp: "2026-06-29T17:30:00Z",
    counterparty: "GB2Q4R6T8V0X2Z4B6D8F0H2J4L6N8P0R2T4V6X8Z0B2D4F6H8J0L2N4P6R8",
    amountLabel: "Encrypted via Twisted ElGamal / BN254",
    proofStatus: "ZK-Verified",
  },
];

export const MOCK_BALANCES: AssetAccount[] = [
  {
    id: "bal-usdc",
    asset: "USDC",
    network: "Stellar Testnet",
    balance: 1250000,
    currency: "USD",
    visible: false,
  },
  {
    id: "bal-eurc",
    asset: "EURC",
    network: "Stellar Testnet",
    balance: 890000,
    currency: "EUR",
    visible: false,
  },
  {
    id: "bal-native",
    asset: "Native Token",
    network: "Soroban L1",
    balance: 707500,
    currency: "USD",
    visible: false,
  },
];

export const MOCK_PROOF: ProofSnapshot = {
  constraintsChecked: 11,
  constraintsTotal: 11,
  circuitVkId: "transfer-vk-bn254-testnet-001",
  publicInputs: {
    old_from_hash: "0x8f3a2b1c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8",
    new_from_hash: "0x22bf2eeb8721d05ddd36830ee67e53582e82809f4e7f12f3c8583f3de543de72",
    old_to_hash: "0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2",
    new_to_hash: "0x2ea17f4860a6df3dfa142f6caaf075fe43a5ab2cf6e1ef3573d3041284df8e65",
  },
};

export const ASSET_OPTIONS = ["USDC", "EURC", "Native Token"] as const;
