"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useShield } from "@/providers/ShieldProvider";
import { ArrowDownToLine, LoaderCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";

export function DepositForm() {
  const { wallet, account, status, deposit } = useShield();
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!wallet.address) return;
    setIsProcessing(true);
    try {
      await deposit(amount);
      setAmount("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Shield Deposit</h1>
        <p className="mt-1 text-sm text-slate-400">
          Convert a public amount into your shielded encrypted balance. The deposit amount is visible
          on-chain; your updated balance remains confidential.
        </p>
      </div>

      <Card className="max-w-2xl border-slate-800/80 bg-slate-950/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-medium text-white">Public → Shielded</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!wallet.address && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Connect Freighter to deposit.
            </div>
          )}

          {wallet.address && !account.registered && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Register on-chain before depositing.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
              Deposit amount (public)
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Amount is homomorphically encrypted in your new balance commitment. Plaintext balance
              is never stored on-chain.
            </p>
          </div>

          {status && (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
              {status}
            </p>
          )}

          <Button
            type="button"
            disabled={!wallet.address || !account.registered || !amount || isProcessing}
            onClick={() => void handleSubmit()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Generating proof &amp; awaiting signature…
              </>
            ) : (
              "Generate Proof & Sign with Freighter"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
