import {
  assertShieldApiConfigured,
  shieldApiBaseUrl,
  shieldApiConfig,
} from "@/lib/shield-api-config";

async function post<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  assertShieldApiConfigured();
  const response = await fetch(`${shieldApiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

export type RegisterResponse = {
  unsignedXdr: string;
  babyJub: { sk: string; pk: { x: string; y: string }; pkHash: string };
  publicSignals: string[];
};

export type TxBuildResponse = {
  unsignedXdr: string;
  publicSignals: string[];
  publicInputs: Record<string, string>;
};

export type HealthResponse = {
  ok: boolean;
  contractId: string | null;
  features?: { deposit: boolean };
};

export const shieldApi = {
  config: shieldApiConfig,

  health: (caller?: string) => {
    assertShieldApiConfigured();
    const query = caller ? `?caller=${encodeURIComponent(caller)}` : "";
    return fetch(`${shieldApiBaseUrl}/health${query}`).then(
      (r) => r.json() as Promise<HealthResponse>,
    );
  },

  register: (address: string) =>
    post<RegisterResponse>("/tx/register", { address }),

  transfer: (input: {
    from: string;
    to: string;
    amount: string;
    babyJubSk: string;
    fromBalance?: string;
    toBalance?: string;
  }) => post<TxBuildResponse>("/tx/transfer", input),

  mint: (input: { admin: string; to: string; amount: string }) =>
    post<TxBuildResponse>("/tx/mint", input, { "x-admin-address": input.admin }),

  deposit: (input: { user: string; amount: string }) =>
    post<TxBuildResponse>("/tx/deposit", input),
};
