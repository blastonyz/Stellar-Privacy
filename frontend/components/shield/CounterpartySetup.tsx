"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopiedToast } from "@/components/ui/CopiedToast";
import { exportViewKeyBackup } from "@/lib/keys/view-key-store";
import { fetchIsRegistered } from "@/lib/shield-protocol";
import { stellarConfig } from "@/lib/stellar";
import { shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { Copy, KeyRound, LoaderCircle, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

type CounterpartySetupProps = {
  receiverAddress: string;
};

export function CounterpartySetup({ receiverAddress }: CounterpartySetupProps) {
  const { wallet, account, register, registerCounterparty } = useShield();
  const [checking, setChecking] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [lastRegisteredAddress, setLastRegisteredAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  }, [target, wallet.address, lastRegisteredAddress]);

  if (!wallet.address) return null;

  const isCounterpartyWallet = wallet.address === target;

  const copyReceptorBackup = async () => {
    const address = lastRegisteredAddress ?? target;
    if (!address) return;
    const backup = exportViewKeyBackup(address);
    if (!backup) return;
    await navigator.clipboard.writeText(backup);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <CopiedToast visible={copied} message="View key backup copied!" />
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
          Receivers must register before accepting shielded transfers. Use Freighter (switch wallet)
          or the testnet demo shortcut below — same as{" "}
          <code className="text-violet-100">make proof-register-receptor</code>.
        </p>

        {stellarConfig.demoReceptorAddress && !receiverAddress.trim() && (
          <p className="mt-2 font-mono text-xs text-violet-200/70">
            Demo receptor: {stellarConfig.demoReceptorAddress}
          </p>
        )}

        {target && registered === false && (
          <div className="mt-3 space-y-3">
            {isCounterpartyWallet ? (
              <>
                <p className="text-xs text-violet-200">
                  Connected as receiver ({shortAddress(target, 6, 6)}).
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
                    {busy ? "Generating proof…" : "Register with Freighter"}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-xs text-violet-200">
                Option A — Switch Freighter to{" "}
                <span className="font-mono text-violet-100">{shortAddress(target, 8, 6)}</span> and
                register.
              </p>
            )}

            {!secretOpen ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSecretOpen(true)}
                className="border-violet-500/30"
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Option B — Register via secret key (demo)
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border border-violet-500/20 bg-slate-950/50 p-3">
                <p className="text-xs text-amber-200/90">
                  Testnet demo only. The secret is sent to your Shield backend over the network to
                  sign registration — never use a funded mainnet key.
                </p>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Receiver Stellar secret key (S...)"
                  autoComplete="off"
                  className="w-full rounded-lg border border-violet-500/30 bg-slate-950 px-3 py-2 font-mono text-xs text-violet-50"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy || !secretKey.trim()}
                    onClick={() => {
                      setBusy(true);
                      void registerCounterparty(secretKey)
                        .then((result) => {
                          setLastRegisteredAddress(result.address);
                          setSecretKey("");
                          setSecretOpen(false);
                        })
                        .finally(() => setBusy(false));
                    }}
                  >
                    {busy ? "Registering…" : "Register on backend"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setSecretOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {registered === true && (lastRegisteredAddress ?? target) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-emerald-200/90">
              View key for counterparty stored in this browser (if registered via demo).
            </p>
            <Button size="sm" variant="secondary" onClick={() => void copyReceptorBackup()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy view key backup
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
