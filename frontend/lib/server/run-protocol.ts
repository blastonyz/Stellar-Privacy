import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function repoRoot(): string {
  return path.resolve(process.cwd(), "..");
}

export async function runProtocol<T>(command: string, payload: unknown): Promise<T> {
  const root = repoRoot();
  const sdkDir = path.join(root, "sdk");
  const script = path.join(sdkDir, "scripts", "frontend-protocol.ts");
  const tsxCli = path.join(sdkDir, "node_modules", "tsx", "dist", "cli.mjs");
  const bootstrap = path.join(sdkDir, "scripts", "bootstrap-env.cjs");

  const { stdout } = await execFileAsync(
    process.execPath,
    ["--require", bootstrap, tsxCli, script, command, JSON.stringify(payload)],
    {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    },
  );

  return JSON.parse(stdout.trim()) as T;
}
