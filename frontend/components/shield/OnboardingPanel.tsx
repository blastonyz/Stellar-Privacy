"use client";

import { Button } from "@/components/ui/Button";
import { useShield } from "@/providers/ShieldProvider";
import { ShieldAlert, KeyRound } from "lucide-react";
import { useState } from "react";

type OnboardingPanelProps = {
  mode: "deposit" | "transfer" | "balance";
};

export function OnboardingPanel({ mode }: OnboardingPanelProps) {
  const { wallet, account, features, register, importViewKey, status } = useShield();
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [busy, setBusy] = useState(false);

  if (!wallet.address) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        Connect Freighter to continue.
      </div>
    );
  }

  if (mode === "deposit" && !features.deposit) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
        <p className="font-medium">Deposit not available on this contract</p>
        <p className="mt-1 text-xs text-rose-200/90">
          Redeploy <code className="text-rose-50">encrypted_token</code> with the{" "}
          <code className="text-rose-50">deposit</code> entrypoint, run{" "}
          <code className="text-rose-50">make upload-vks</code>, then update{" "}
          <code className="text-rose-50">ENCRYPTED_TOKEN_CONTRACT_ID</code> in{" "}
          <code className="text-rose-50">.env</code> and frontend env.
        </p>
      </div>
    );
  }

  if (!account.registered) {
    return (
      <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
        <p className="text-sm text-slate-200">
          Step 1 — Register on-chain. A BabyJub view key is generated and saved in this browser
          (needed to decrypt balances and sign transfers).
        </p>
        <Button
          size="sm"
          disabled={busy || wallet.networkMismatch}
          onClick={() => {
            setBusy(true);
            void register()
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Generating proof…" : "Register with ZK Proof"}
        </Button>
      </div>
    );
  }

  if ((mode === "transfer" || mode === "balance") && !account.babyJubSk) {
    return (
      <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
        <div className="flex items-start gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="space-y-2 text-sm text-amber-100">
            <p className="font-medium">Step 2 — View key required</p>
            <p>
              You are registered on-chain but this browser has no view key. Paste a backup from the
              device where you registered, or register from a new Stellar account.
            </p>
            {!importOpen ? (
              <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
                Import view key
              </Button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={importValue}
                  onChange={(e) => setImportValue(e.target.value)}
                  placeholder='Paste backup JSON or raw BabyJub secret (decimal string)'
                  className="min-h-[80px] w-full rounded-lg border border-amber-500/30 bg-slate-950 px-3 py-2 font-mono text-xs text-amber-50"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setBusy(true);
                      void importViewKey(importValue)
                        .then(() => setImportOpen(false))
                        .finally(() => setBusy(false));
                    }}
                    disabled={busy || !importValue.trim()}
                  >
                    Save view key
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setImportOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {status?.includes("view key") && (
              <p className="text-xs text-amber-200/80">{status}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function DepositSteps() {
  const { wallet, account, features } = useShield();

  const steps = [
    { label: "Connect Freighter", done: Boolean(wallet.address) },
    { label: "Register + view key", done: account.registered },
    { label: "Deposit enabled on contract", done: features.deposit },
    { label: "Generate proof & sign", done: false },
  ];

  return (
    <ol className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-500">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`rounded-full border px-2.5 py-1 ${
            step.done
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-slate-700 text-slate-500"
          }`}
        >
          {index + 1}. {step.label}
        </li>
      ))}
    </ol>
  );
}
