#!/usr/bin/env node
/**
 * Seed GCS (or local register-states dir) from circuits/build/register/state.json.
 * Uses `gcloud storage cp` when a bucket is set (same auth as gcloud CLI).
 *
 * Usage:
 *   $env:GCS_REGISTER_STATE_BUCKET = "verifier-501200-register-states"
 *   node backend/scripts/seed-register-state.mjs
 *   node backend/scripts/seed-register-state.mjs circuits/build/register/state-receptor.json
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const statePath =
  process.argv[2] ?? path.join(repoRoot, "circuits", "build", "register", "state.json");

if (!fs.existsSync(statePath)) {
  console.error(`Missing ${statePath}`);
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
if (!state.stellarAddress || !state.sk) {
  console.error("state file must include stellarAddress and sk");
  process.exit(1);
}

const record = {
  stellarAddress: state.stellarAddress,
  sk: state.sk,
  pk: state.pk ?? { x: "0", y: "0" },
  pkHash: state.pkHash ?? "",
  savedAt: new Date().toISOString(),
  source: "register",
};

const safe = state.stellarAddress.replace(/[^A-Z0-9]/gi, "_");
const prefix = (process.env.GCS_REGISTER_STATE_PREFIX ?? "register-states").replace(/\/+$/, "");
const objectName = `${prefix}/${safe}.json`;
const body = JSON.stringify(record, null, 2);

const bucket = process.env.GCS_REGISTER_STATE_BUCKET;

function uploadWithGcloud(localPath) {
  const dest = `gs://${bucket}/${objectName}`;
  const result = spawnSync("gcloud", ["storage", "cp", localPath, dest], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `gcloud storage cp failed. Run: gcloud auth login && gcloud config set project verifier-501200`,
    );
  }
  console.log(`Uploaded ${dest}`);
}

if (bucket) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shield-seed-"));
  const tmpFile = path.join(tmpDir, `${safe}.json`);
  try {
    fs.writeFileSync(tmpFile, body, "utf8");
    uploadWithGcloud(tmpFile);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
} else {
  const dir =
    process.env.REGISTER_STATE_DIR ??
    path.join(repoRoot, "backend", "data", "register-states");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${safe}.json`);
  fs.writeFileSync(out, body, "utf8");
  console.log(`Wrote ${out}`);
}
