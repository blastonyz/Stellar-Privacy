export const VIEW_KEY_STORAGE_PREFIX = "shield-babyjub-sk:";

export function loadViewKey(address: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${VIEW_KEY_STORAGE_PREFIX}${address}`);
}

export function saveViewKey(address: string, sk: string): void {
  window.localStorage.setItem(`${VIEW_KEY_STORAGE_PREFIX}${address}`, sk);
}

export function exportViewKeyBackup(address: string): string | null {
  const sk = loadViewKey(address);
  if (!sk) return null;
  return JSON.stringify({ version: 1, address, sk, exportedAt: new Date().toISOString() });
}

export function importViewKeyBackup(json: string): { address: string; sk: string } {
  const parsed = JSON.parse(json) as { address?: string; sk?: string };
  if (!parsed.address || !parsed.sk) {
    throw new Error("Invalid view key backup format");
  }
  saveViewKey(parsed.address, parsed.sk);
  return { address: parsed.address, sk: parsed.sk };
}

// Backward-compatible aliases
export const loadBabyJubSecret = loadViewKey;
export const saveBabyJubSecret = saveViewKey;
