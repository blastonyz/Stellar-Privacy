import { Router } from "express";
import { config } from "../config.js";
import { getContractFeatures } from "../services/contract-features.js";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  const caller =
    typeof req.query.caller === "string"
      ? req.query.caller
      : config.adminPublicKey || undefined;

  const features = await getContractFeatures(caller);

  res.json({
    ok: true,
    prover: config.rapidsnarkBin ? "rapidsnark" : "snarkjs",
    rapidsnarkBin: config.rapidsnarkBin ?? null,
    rpc: config.rpcUrl,
    contractId: config.contractId || null,
    allowCounterpartyRegister: config.allowCounterpartyRegister,
    features,
  });
});
