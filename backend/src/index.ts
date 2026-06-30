import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { txRouter } from "./routes/tx.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "2mb" }));

const txLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(healthRouter);
app.use("/tx", txLimiter, txRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[shield-backend]", message);
  res.status(500).json({ error: message });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Shield backend listening on 0.0.0.0:${config.port}`);
  console.log(`Prover: ${config.rapidsnarkBin ? "rapidsnark" : "snarkjs (fallback)"}`);
});
