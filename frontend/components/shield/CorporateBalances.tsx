"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { OnboardingPanel } from "@/components/shield/OnboardingPanel";
import { ViewKeyPanel } from "@/components/shield/ViewKeyPanel";
import { cn } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function CorporateBalances() {
  const { wallet, account, decryptLocalBalance } = useShield();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleVisibility = async () => {
    if (!visible && account.decryptedBalance === null) {
      setBusy(true);
      try {
        await decryptLocalBalance();
      } catch (error) {
        console.error(error);
      } finally {
        setBusy(false);
      }
    }
    setVisible((value) => !value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Corporate Balances</h1>
        <p className="mt-1 text-sm text-slate-400">
          On-chain encrypted balance fetched via Soroban simulation and decrypted locally.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-white">Shielded Asset Account</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <OnboardingPanel mode="balance" />
          <ViewKeyPanel />

          {!wallet.address ? (
            <p className="text-sm text-slate-500">Connect Freighter to inspect your shielded balance.</p>
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium text-white">Encrypted Token Balance</h3>
                  <Badge tone="info">Twisted ElGamal Curve</Badge>
                  <Badge tone="neutral">BN254 Optimised</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {account.registered ? "Registered on encrypted_token" : "Not registered"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <p className={cn("text-2xl font-semibold tabular-nums text-white")}>
                  {visible && account.decryptedBalance !== null
                    ? `${account.decryptedBalance} units`
                    : "•••••••"}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!account.registered || !account.babyJubSk || busy}
                  onClick={() => void toggleVisibility()}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {visible ? "Hide" : "Reveal"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
