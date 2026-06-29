import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

loadEnv({ path: path.join(projectRoot, ".env") });
loadEnv({ path: path.join(projectRoot, "sdk", ".env"), override: false });

if (process.env.NODE_TLS !== "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
