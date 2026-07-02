import fs from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import { appRoot, config } from "../config.js";

export type StoredRegisterState = {
  stellarAddress: string;
  sk: string;
  pk: { x: string; y: string };
  pkHash: string;
  savedAt: string;
  source: "register" | "register-counterparty";
};

let gcsStorage: Storage | null = null;

function useGcs(): boolean {
  return Boolean(config.gcsRegisterStateBucket);
}

function gcsClient(): Storage {
  if (!gcsStorage) {
    gcsStorage = new Storage();
  }
  return gcsStorage;
}

function registerStateDir(): string {
  return config.registerStateDir ?? path.join(appRoot, "data", "register-states");
}

function localStateFilePath(address: string): string {
  const safe = address.replace(/[^A-Z0-9]/gi, "_");
  return path.join(registerStateDir(), `${safe}.json`);
}

function gcsObjectName(address: string): string {
  const safe = address.replace(/[^A-Z0-9]/gi, "_");
  const prefix = config.gcsRegisterStatePrefix.replace(/\/+$/, "");
  return `${prefix}/${safe}.json`;
}

function ensureLocalDir(): void {
  const dir = registerStateDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseRecord(raw: string): StoredRegisterState | null {
  try {
    return JSON.parse(raw) as StoredRegisterState;
  } catch {
    return null;
  }
}

async function saveLocal(address: string, record: StoredRegisterState): Promise<void> {
  ensureLocalDir();
  fs.writeFileSync(localStateFilePath(address), JSON.stringify(record, null, 2), "utf8");
}

async function readLocal(address: string): Promise<StoredRegisterState | null> {
  const filePath = localStateFilePath(address);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return parseRecord(fs.readFileSync(filePath, "utf8"));
}

async function saveGcs(address: string, record: StoredRegisterState): Promise<void> {
  const bucket = gcsClient().bucket(config.gcsRegisterStateBucket!);
  await bucket.file(gcsObjectName(address)).save(JSON.stringify(record, null, 2), {
    contentType: "application/json",
    metadata: { cacheControl: "no-store" },
  });
}

async function readGcs(address: string): Promise<StoredRegisterState | null> {
  const file = gcsClient().bucket(config.gcsRegisterStateBucket!).file(gcsObjectName(address));
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  const [contents] = await file.download();
  return parseRecord(contents.toString("utf8"));
}

/** Persist BabyJub sk when a register proof is built (local dir and/or GCS bucket). */
export async function saveRegisterState(
  address: string,
  babyJub: { sk: string; pk: { x: string; y: string }; pkHash: string },
  source: StoredRegisterState["source"],
): Promise<void> {
  if (!config.persistRegisterState) {
    return;
  }

  const record: StoredRegisterState = {
    stellarAddress: address,
    sk: babyJub.sk,
    pk: babyJub.pk,
    pkHash: babyJub.pkHash,
    savedAt: new Date().toISOString(),
    source,
  };

  if (useGcs()) {
    await saveGcs(address, record);
    return;
  }

  await saveLocal(address, record);
}

export async function readRegisterState(address: string): Promise<StoredRegisterState | null> {
  if (useGcs()) {
    return readGcs(address);
  }
  return readLocal(address);
}

export function registerStateBackend(): "gcs" | "filesystem" | "disabled" {
  if (!config.persistRegisterState) {
    return "disabled";
  }
  return useGcs() ? "gcs" : "filesystem";
}
