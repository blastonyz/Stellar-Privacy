import { Router, type Request, type Response, type NextFunction } from "express";
import { config } from "../config.js";
import {
  buildDepositTransaction,
  buildMintTransaction,
  buildRegisterTransaction,
  buildTransferTransaction,
  proveFromWitness,
} from "../services/protocol.js";

export const txRouter = Router();

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function requireAdmin(req: Request): string {
  const admin = String(req.headers["x-admin-address"] ?? req.body?.admin ?? "");
  if (!config.adminPublicKey) {
    throw new Error("ADMIN_PUBLIC_KEY is not configured on the server");
  }
  if (admin !== config.adminPublicKey) {
    throw new Error("Unauthorized: admin wallet required for mint");
  }
  return admin;
}

txRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { address } = req.body as { address?: string };
    if (!address) {
      res.status(400).json({ error: "Missing address" });
      return;
    }
    const result = await buildRegisterTransaction(address);
    res.json(result);
  }),
);

txRouter.post(
  "/transfer",
  asyncHandler(async (req, res) => {
    const body = req.body as {
      from?: string;
      to?: string;
      amount?: string;
      babyJubSk?: string;
      fromBalance?: string;
      toBalance?: string;
    };
    if (!body.from || !body.to || !body.amount || !body.babyJubSk) {
      res.status(400).json({ error: "Missing from, to, amount, or babyJubSk" });
      return;
    }
    const result = await buildTransferTransaction(body as Required<typeof body>);
    res.json(result);
  }),
);

txRouter.post(
  "/mint",
  asyncHandler(async (req, res) => {
    const admin = requireAdmin(req);
    const { to, amount } = req.body as { to?: string; amount?: string };
    if (!to || !amount) {
      res.status(400).json({ error: "Missing to or amount" });
      return;
    }
    const result = await buildMintTransaction({ admin, to, amount });
    res.json(result);
  }),
);

txRouter.post(
  "/deposit",
  asyncHandler(async (req, res) => {
    const { user, amount } = req.body as { user?: string; amount?: string };
    if (!user || !amount) {
      res.status(400).json({ error: "Missing user or amount" });
      return;
    }
    const result = await buildDepositTransaction({ user, amount });
    res.json(result);
  }),
);

txRouter.post(
  "/prove/:circuit",
  asyncHandler(async (req, res) => {
    const circuit = req.params.circuit as "register" | "mint" | "transfer" | "deposit";
    if (!["register", "mint", "transfer", "deposit"].includes(circuit)) {
      res.status(400).json({ error: `Unknown circuit: ${circuit}` });
      return;
    }
    const { witness } = req.body as { witness?: Record<string, string> };
    if (!witness) {
      res.status(400).json({ error: "Missing witness" });
      return;
    }
    const result = await proveFromWitness(circuit, witness);
    res.json(result);
  }),
);
