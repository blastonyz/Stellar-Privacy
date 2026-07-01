export function formatSimulationError(raw: string): string {
  if (raw.includes("non-existent contract function") && raw.includes("deposit")) {
    return "Deposit is not available on the deployed contract. Redeploy encrypted_token with the deposit entrypoint, upload the Deposit VK, and update ENCRYPTED_TOKEN_CONTRACT_ID.";
  }

  if (raw.includes("MissingValue") && raw.includes("deposit")) {
    return "Deposit is not available on the deployed contract. Redeploy encrypted_token with the deposit entrypoint and upload the Deposit VK.";
  }

  return raw;
}
