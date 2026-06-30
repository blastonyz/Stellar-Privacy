const BASE_URL = process.env.NEXT_PUBLIC_SHIELD_API ?? "http://localhost:8787";

async function post<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
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

export const shieldApi = {
  health: () => fetch(`${BASE_URL}/health`).then((r) => r.json()),

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
