export function formatShieldError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("non-existent contract function") &&
    message.includes("deposit")
  ) {
    return "Deposit is not available on the deployed contract yet. Redeploy encrypted_token with the deposit entrypoint, run upload-vks for Deposit, and point ENCRYPTED_TOKEN_CONTRACT_ID to the new contract.";
  }

  if (message.includes("MissingValue") && message.includes("deposit")) {
    return "Deposit is not available on the deployed contract yet. Redeploy encrypted_token with the deposit entrypoint and upload the Deposit VK.";
  }

  const simulationPrefix = "Simulation failed: ";
  if (message.startsWith(simulationPrefix)) {
    return formatShieldError(message.slice(simulationPrefix.length));
  }

  return message;
}

export const VIEW_KEY_REQUIRED_MESSAGE =
  "No view key in this browser. Import your backup or register from a new Stellar account.";
