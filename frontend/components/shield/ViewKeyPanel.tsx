"use client";

import { Button } from "@/components/ui/Button";
import { CopiedToast } from "@/components/ui/CopiedToast";
import {
  exportViewKeyBackup,
  isLikelyBalanceHash,
} from "@/lib/keys/view-key-store";
import { useShield } from "@/providers/ShieldProvider";
import { CheckCircle2, Copy, KeyRound, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

type ViewKeyPanelProps = {
  /** When true, hide if no view key (import handled by OnboardingPanel). */
  requireSaved?: boolean;
};

export function ViewKeyPanel({ requireSaved = false }: ViewKeyPanelProps) {
  const { wallet, account, clearViewKey: clearKey, importViewKey, recoverViewKeyFromServer } =
    useShield();
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [busy, setBusy] = useState(false);

  const rawStored =
    wallet.address && typeof window !== "undefined"
      ? window.localStorage.getItem(`shield-babyjub-sk:${wallet.address}`)
      : null;
  const corruptKey = Boolean(rawStored && isLikelyBalanceHash(rawStored));

  const copyBackup = useCallback(async () => {
    if (!wallet.address) return;
    const backup = exportViewKeyBackup(wallet.address);
    if (!backup) return;
    await navigator.clipboard.writeText(backup);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [wallet.address]);

  const handleClear = useCallback(() => {
    if (!wallet.address) return;
    clearKey(wallet.address);
    setImportOpen(true);
  }, [clearKey, wallet.address]);

  if (!wallet.address || !account.registered) return null;
  if (requireSaved && account.babyJubSk && !corruptKey) return null;

  return (
    <>
      <CopiedToast visible={copied} message="View key backup copied (decimal sk in JSON)!" />
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {account.babyJubSk && !corruptKey ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <div className="space-y-1 text-sm">
              <p className="font-medium text-slate-200">View key</p>
              <p className="text-xs text-slate-500">
                {corruptKey
                  ? "A proof hash was saved by mistake (hex). Clear it and import your decimal backup."
                  : account.babyJubSk
                    ? "Saved in this browser as a decimal BabyJub secret. Use Copy backup to recover on another device."
                    : "Not in this browser — import your backup JSON or decimal sk from registration."}
              </p>
              <p className="text-xs text-slate-600">
                Not the hex values under Compliance → Public Inputs (those are balance hashes).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {account.babyJubSk && !corruptKey && (
              <Button size="sm" variant="secondary" onClick={() => void copyBackup()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy backup
              </Button>
            )}
            {(account.babyJubSk || corruptKey) && (
              <Button size="sm" variant="secondary" onClick={handleClear}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear saved key
              </Button>
            )}
            {!account.babyJubSk || corruptKey ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void recoverViewKeyFromServer().finally(() => setBusy(false));
                  }}
                >
                  Recover from server
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setImportOpen((v) => !v)}>
                  Import view key
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {importOpen && (
          <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
            <textarea
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              placeholder='Paste backup JSON {"version":1,"address":"G...","sk":"2105581..."} or decimal sk only'
              className="min-h-[80px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !importValue.trim()}
                onClick={() => {
                  setBusy(true);
                  void importViewKey(importValue)
                    .then(() => {
                      setImportOpen(false);
                      setImportValue("");
                    })
                    .finally(() => setBusy(false));
                }}
              >
                Save view key
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
