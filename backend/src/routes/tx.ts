import { Router, type Request, type Response, type NextFunction } from "express";
import { config } from "../config.js";
import { readRegisterState } from "../lib/register-state-store.js";
import { resolveReceiverViewKey } from "../lib/receptor-keys.js";
import {
  buildDepositTransaction,
  buildMintTransaction,
  buildRegisterTransaction,
  buildTransferTransaction,
  proveFromWitness,
  registerCounterpartyWithSecret,
} from "../services/protocol.js";
import { fetchIsRegistered } from "../services/stellar.js";

export const txRouter = Router();

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function mintAdminAddress(req: Request): string {
  const admin = String(req.headers["x-admin-address"] ?? req.body?.admin ?? "");
  if (!admin) {
    throw new Error("Missing admin address — connect Freighter and retry");
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
  "/register-counterparty",
  asyncHandler(async (req, res) => {
    if (!config.allowCounterpartyRegister) {
      res.status(403).json({
        error:
          "Counterparty registration via secret key is disabled. Set ALLOW_COUNTERPARTY_REGISTER=true or use Freighter.",
      });
      return;
    }

    const { secretKey } = req.body as { secretKey?: string };
    if (!secretKey?.trim()) {
      res.status(400).json({ error: "Missing secretKey" });
      return;
    }

    const result = await registerCounterpartyWithSecret(secretKey);
    res.json(result);
  }),
);

txRouter.post(
  "/recover-view-key",
  asyncHandler(async (req, res) => {
    if (!config.persistRegisterState) {
      res.status(403).json({ error: "Server-side view key recovery is disabled." });
      return;
    }

    const { address } = req.body as { address?: string };
    const walletHeader = String(req.headers["x-wallet-address"] ?? "");
    if (!address?.trim()) {
      res.status(400).json({ error: "Missing address" });
      return;
    }
    if (!walletHeader || walletHeader !== address.trim()) {
      res.status(403).json({
        error: "Connect Freighter and retry — recovery requires x-wallet-address to match your address.",
      });
      return;
    }

    const trimmed = address.trim();
    const registered = await fetchIsRegistered(trimmed, trimmed);
    if (!registered) {
      res.status(404).json({ error: "Address is not registered on-chain." });
      return;
    }

    const state = await readRegisterState(trimmed);
    if (!state?.sk) {
      res.status(404).json({
        error:
          "No view key on file for this address. Register before this deploy, or from another browser without server persistence, cannot be recovered here.",
      });
      return;
    }

    res.json({
      address: trimmed,
      sk: state.sk,
      pk: state.pk,
      pkHash: state.pkHash,
      savedAt: state.savedAt,
    });
  }),
);

txRouter.post(
  "/counterparty-view-key",
  asyncHandler(async (req, res) => {
    const { address } = req.body as { address?: string };
    if (!address?.trim()) {
      res.status(400).json({ error: "Missing address" });
      return;
    }
    const sk = await resolveReceiverViewKey(address.trim());
    if (!sk) {
      res.status(404).json({
        error: "No local demo view key for this address (run make proof-register-receptor)",
      });
      return;
    }
    res.json({ address: address.trim(), sk });
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
      toBabyJubSk?: string;
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
    const admin = mintAdminAddress(req);
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
