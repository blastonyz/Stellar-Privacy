"use client";

import { Button } from "@/components/ui/Button";
import { CopiedToast } from "@/components/ui/CopiedToast";
import { exportViewKeyBackup } from "@/lib/keys/view-key-store";
import { useShield } from "@/providers/ShieldProvider";
import { CheckCircle2, Copy, KeyRound } from "lucide-react";
import { useCallback, useState } from "react";

type ViewKeyPanelProps = {
  /** When true, hide if no view key (import handled by OnboardingPanel). */
  requireSaved?: boolean;
};

export function ViewKeyPanel({ requireSaved = false }: ViewKeyPanelProps) {
  const { wallet, account } = useShield();
  const [copied, setCopied] = useState(false);

  const copyBackup = useCallback(async () => {
    if (!wallet.address) return;
    const backup = exportViewKeyBackup(wallet.address);
    if (!backup) return;
    await navigator.clipboard.writeText(backup);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [wallet.address]);

  if (!wallet.address || !account.registered) return null;
  if (requireSaved && !account.babyJubSk) return null;

  return (
    <>
      <CopiedToast visible={copied} />
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {account.babyJubSk ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <div className="space-y-1 text-sm">
              <p className="font-medium text-slate-200">View key</p>
              <p className="text-xs text-slate-500">
                {account.babyJubSk
                  ? "Saved in this browser (localStorage). Needed to decrypt balances and build transfer proofs."
                  : "Not in this browser — import your backup to decrypt or transfer."}
              </p>
            </div>
          </div>
          {account.babyJubSk && (
            <Button size="sm" variant="secondary" onClick={() => void copyBackup()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy backup
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
