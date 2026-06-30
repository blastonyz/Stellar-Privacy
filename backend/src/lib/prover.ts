import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import * as snarkjs from "snarkjs";

const execFileAsync = promisify(execFile);

export type CircuitName = "register" | "mint" | "transfer" | "deposit";

export function circuitArtifacts(
  vkBuildDir: string,
  circuit: CircuitName,
): { wasmPath: string; zkeyPath: string } {
  const dir = path.join(vkBuildDir, circuit);
  return {
    wasmPath: path.join(dir, `${circuit}_js`, `${circuit}.wasm`),
    zkeyPath: path.join(dir, `${circuit}.zkey`),
  };
}

/**
 * Generate a Groth16 proof using rapidsnark when available, otherwise snarkjs.
 */
export async function groth16Prove(
  input: Record<string, string>,
  wasmPath: string,
  zkeyPath: string,
  rapidsnarkBin?: string,
): Promise<{ proof: snarkjs.Groth16Proof; publicSignals: string[] }> {
  if (rapidsnarkBin) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shield-prove-"));
    const wtnsPath = path.join(tmpDir, "witness.wtns");
    const proofPath = path.join(tmpDir, "proof.json");
    const publicPath = path.join(tmpDir, "public.json");
    try {
      await snarkjs.wtns.calculate(input, wasmPath, wtnsPath);
      await execFileAsync(rapidsnarkBin, [zkeyPath, wtnsPath, proofPath, publicPath], {
        maxBuffer: 64 * 1024 * 1024,
      });
      const proof = JSON.parse(await fs.readFile(proofPath, "utf8")) as snarkjs.Groth16Proof;
      const publicSignals = JSON.parse(await fs.readFile(publicPath, "utf8")) as string[];
      return { proof, publicSignals: publicSignals.map(String) };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
  return { proof, publicSignals: publicSignals.map(String) };
}

export async function proveCircuit(
  circuit: CircuitName,
  input: Record<string, string>,
  vkBuildDir: string,
  rapidsnarkBin?: string,
): Promise<{ proof: snarkjs.Groth16Proof; publicSignals: string[] }> {
  const { wasmPath, zkeyPath } = circuitArtifacts(vkBuildDir, circuit);
  return groth16Prove(input, wasmPath, zkeyPath, rapidsnarkBin);
}
