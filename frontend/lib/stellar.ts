import * as StellarSdk from "@stellar/stellar-sdk";

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

const configs = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL ?? "",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    friendbotUrl: null as string | null,
  },
} as const;

export const stellarConfig = {
  ...(configs[NETWORK as keyof typeof configs] ?? configs.testnet),
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ??
    configs[NETWORK as keyof typeof configs]?.horizonUrl ??
    configs.testnet.horizonUrl,
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ??
    configs[NETWORK as keyof typeof configs]?.rpcUrl ??
    configs.testnet.rpcUrl,
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
    configs[NETWORK as keyof typeof configs]?.networkPassphrase ??
    configs.testnet.networkPassphrase,
  contractId: process.env.NEXT_PUBLIC_ENCRYPTED_TOKEN_CONTRACT_ID ?? "",
  demoReceptorAddress: process.env.NEXT_PUBLIC_DEMO_RECEPTOR_ADDRESS ?? "",
};

export const horizon = new StellarSdk.Horizon.Server(stellarConfig.horizonUrl);
export const rpc = new StellarSdk.rpc.Server(stellarConfig.rpcUrl);

export function assertContractConfigured(): void {
  if (!stellarConfig.contractId) {
    throw new Error("Missing NEXT_PUBLIC_ENCRYPTED_TOKEN_CONTRACT_ID");
  }
}

export function networkLabel(passphrase: string): string {
  if (passphrase === StellarSdk.Networks.TESTNET) return "Testnet";
  if (passphrase === StellarSdk.Networks.PUBLIC) return "Mainnet";
  return "Custom";
}
