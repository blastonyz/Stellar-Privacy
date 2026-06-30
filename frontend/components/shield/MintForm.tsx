"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { stellarConfig } from "@/lib/stellar";
import { shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { Coins, LoaderCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";

export function MintForm() {
  const { wallet, status, mint } = useShield();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const adminKey = process.env.NEXT_PUBLIC_ADMIN_PUBLIC_KEY ?? "";
  const isAdmin = Boolean(wallet.address && adminKey && wallet.address === adminKey);

  const handleSubmit = async () => {
    if (!wallet.address) return;
    setIsProcessing(true);
    try {
      await mint(recipient, amount);
      setRecipient("");
      setAmount("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!adminKey) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
        Admin mint is disabled. Set <code className="text-cyan-400">NEXT_PUBLIC_ADMIN_PUBLIC_KEY</code>{" "}
        in <code className="text-cyan-400">frontend/.env.local</code>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Enterprise Mint</h1>
        <p className="mt-1 text-sm text-slate-400">
          Admin-only standalone supply injection to a registered recipient. Circulation remains
          encrypted on-chain.
        </p>
      </div>

      <Card className="max-w-2xl border-slate-800/80 bg-slate-950/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-medium text-white">Private Mint</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!wallet.address && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Connect the admin Freighter wallet.
            </div>
          )}

          {wallet.address && !isAdmin && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              Connected wallet {shortAddress(wallet.address)} is not the configured admin (
              {shortAddress(adminKey)}).
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
              Admin signer
            </label>
            <input
              readOnly
              value={wallet.address ? shortAddress(wallet.address) : "Not connected"}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
              Recipient Stellar address
            </label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="G..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
              Mint amount
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <p className="text-xs text-slate-500">
            Contract: {stellarConfig.contractId ? shortAddress(stellarConfig.contractId) : "not configured"}
          </p>

          {status && (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
              {status}
            </p>
          )}

          <Button
            type="button"
            disabled={!isAdmin || !recipient || !amount || isProcessing}
            onClick={() => void handleSubmit()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Generating mint proof…
              </>
            ) : (
              "Mint & Sign with Freighter"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
