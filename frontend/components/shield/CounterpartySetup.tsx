"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchIsRegistered } from "@/lib/shield-protocol";
import { stellarConfig } from "@/lib/stellar";
import { shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { LoaderCircle, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

type CounterpartySetupProps = {
  receiverAddress: string;
};

export function CounterpartySetup({ receiverAddress }: CounterpartySetupProps) {
  const { wallet, account, register } = useShield();
  const [checking, setChecking] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const target =
    receiverAddress.trim() ||
    stellarConfig.demoReceptorAddress ||
    "";

  useEffect(() => {
    if (!target || !wallet.address) {
      setRegistered(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void fetchIsRegistered(wallet.address, target)
      .then((value) => {
        if (!cancelled) setRegistered(value);
      })
      .catch(() => {
        if (!cancelled) setRegistered(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target, wallet.address]);

  if (!wallet.address) return null;

  const isCounterpartyWallet = wallet.address === target;

  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <UserPlus className="h-4 w-4 text-violet-300" />
        <p className="font-medium text-violet-100">Counterparty registration</p>
        {checking && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-violet-300" />}
        {!checking && registered === true && <Badge tone="success">Registered on-chain</Badge>}
        {!checking && registered === false && target && (
          <Badge tone="warning">Not registered</Badge>
        )}
      </div>

      <p className="text-xs text-violet-200/80">
        Receivers must register before accepting shielded transfers (same flow as{" "}
        <code className="text-violet-100">make proof-register-receptor</code>). They connect
        Freighter with their Stellar account and register here — view key stays in their browser.
      </p>

      {stellarConfig.demoReceptorAddress && !receiverAddress.trim() && (
        <p className="mt-2 font-mono text-xs text-violet-200/70">
          Demo receptor: {stellarConfig.demoReceptorAddress}
        </p>
      )}

      {target && registered === false && (
        <div className="mt-3 space-y-2">
          {isCounterpartyWallet ? (
            <>
              <p className="text-xs text-violet-200">
                You are connected as the receiver ({shortAddress(target, 6, 6)}). Register this
                wallet to receive shielded payments.
              </p>
              {!account.registered && (
                <Button
                  size="sm"
                  disabled={busy || wallet.networkMismatch}
                  onClick={() => {
                    setBusy(true);
                    void register().finally(() => setBusy(false));
                  }}
                >
                  {busy ? "Generating proof…" : "Register counterparty wallet"}
                </Button>
              )}
              {account.registered && !account.babyJubSk && (
                <p className="text-xs text-amber-200">
                  Registered on-chain — import or save your view key below to decrypt incoming
                  balances.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-violet-200">
              Switch Freighter to{" "}
              <span className="font-mono text-violet-100">{shortAddress(target, 8, 6)}</span>, open
              Dashboard or Transfer, and click <strong>Register with ZK Proof</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
