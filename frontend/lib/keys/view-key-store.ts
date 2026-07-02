export const VIEW_KEY_STORAGE_PREFIX = "shield-babyjub-sk:";

/** 32-byte balance / proof hashes — not BabyJub view keys. */
const BALANCE_HASH_HEX = /^[0-9a-fA-F]{64}$/;

export function isLikelyBalanceHash(value: string): boolean {
  return BALANCE_HASH_HEX.test(value.trim());
}

/**
 * BabyJub view keys are stored as decimal strings (from register API / backup JSON).
 * Rejects 64-char hex values (public proof hashes shown in Compliance → Public Inputs).
 */
export function normalizeViewKeySk(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    const backup = parseViewKeyBackup(trimmed);
    return normalizeViewKeySk(backup.sk);
  }

  if (isLikelyBalanceHash(trimmed)) {
    throw new Error(
      "That value is a balance/proof hash (hex), not your view key. After register use “Copy backup” on the dashboard, or paste the decimal sk from your backup JSON.",
    );
  }

  let decimal: string;
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    decimal = BigInt(trimmed).toString();
  } else if (/^[0-9a-fA-F]+$/i.test(trimmed) && /[a-fA-F]/i.test(trimmed)) {
    decimal = BigInt(`0x${trimmed}`).toString();
  } else if (/^\d+$/.test(trimmed)) {
    decimal = trimmed;
  } else {
    throw new Error(
      "View key must be a decimal string or backup JSON — not a Stellar address or tx hash.",
    );
  }

  const n = BigInt(decimal);
  if (n <= 0n) {
    throw new Error("Invalid view key.");
  }

  return decimal;
}

export function loadViewKey(address: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${VIEW_KEY_STORAGE_PREFIX}${address}`);
  if (!raw) return null;
  if (isLikelyBalanceHash(raw)) return null;
  return raw;
}

export function saveViewKey(address: string, sk: string): void {
  const normalized = normalizeViewKeySk(sk);
  window.localStorage.setItem(`${VIEW_KEY_STORAGE_PREFIX}${address}`, normalized);
}

export function clearViewKey(address: string): void {
  window.localStorage.removeItem(`${VIEW_KEY_STORAGE_PREFIX}${address}`);
}

export function clearAllViewKeys(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(VIEW_KEY_STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function exportViewKeyBackup(address: string): string | null {
  const sk = loadViewKey(address);
  if (!sk) return null;
  return JSON.stringify({ version: 1, address, sk, exportedAt: new Date().toISOString() });
}

export function parseViewKeyBackup(json: string): { address: string; sk: string } {
  const parsed = JSON.parse(json) as { address?: string; sk?: string };
  if (!parsed.address || !parsed.sk) {
    throw new Error("Invalid view key backup format");
  }
  return { address: parsed.address, sk: normalizeViewKeySk(parsed.sk) };
}

export function importViewKeyBackup(json: string): { address: string; sk: string } {
  const backup = parseViewKeyBackup(json);
  saveViewKey(backup.address, backup.sk);
  return backup;
}

// Backward-compatible aliases
export const loadBabyJubSecret = loadViewKey;
export const saveBabyJubSecret = saveViewKey;
