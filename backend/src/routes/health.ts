import { Router } from "express";
import { config } from "../config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    prover: config.rapidsnarkBin ? "rapidsnark" : "snarkjs",
    rapidsnarkBin: config.rapidsnarkBin ?? null,
    rpc: config.rpcUrl,
    contractId: config.contractId || null,
  });
});
