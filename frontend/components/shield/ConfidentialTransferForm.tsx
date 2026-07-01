"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { CounterpartySetup } from "@/components/shield/CounterpartySetup";
import { OnboardingPanel } from "@/components/shield/OnboardingPanel";
import { ViewKeyPanel } from "@/components/shield/ViewKeyPanel";
import { ASSET_OPTIONS } from "@/lib/mock-data";
import { stellarConfig } from "@/lib/stellar";
import { shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function ConfidentialTransferForm() {
  const { wallet, account, status, transfer } = useShield();
  const [receiver, setReceiver] = useState(stellarConfig.demoReceptorAddress);
  const [asset, setAsset] = useState<string>(ASSET_OPTIONS[0]);
  const [amount, setAmount] = useState("");
  const [fromBalance, setFromBalance] = useState("100");
  const [toBalance, setToBalance] = useState("0");
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);

  const canTransfer =
    Boolean(wallet.address) &&
    account.registered &&
    Boolean(account.babyJubSk) &&
    !wallet.networkMismatch;

  useEffect(() => {
    if (!receiver && stellarConfig.demoReceptorAddress) {
      setReceiver(stellarConfig.demoReceptorAddress);
    }
  }, [receiver]);

  const handleSubmit = async () => {
    if (!wallet.address) return;
    setIsGeneratingProof(true);
    try {
      await transfer({
        to: receiver,
        amount,
        fromBalance,
        toBalance,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingProof(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Confidential Transfer</h1>
        <p className="mt-1 text-sm text-slate-400">
          Generate a Groth16 proof server-side, sign with Freighter, and submit to Soroban.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <h2 className="text-base font-medium text-white">Initiate Shielded B2B Settlement</h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <OnboardingPanel mode="transfer" />
          <ViewKeyPanel requireSaved />
          <CounterpartySetup receiverAddress={receiver} />

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Sender Address</span>
            <input
              readOnly
              value={wallet.address ?? "Connect Freighter to continue"}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5 font-mono text-xs text-slate-300"
            />
            {wallet.address && (
              <span className="text-xs text-slate-500">
                Connected via Freighter ({shortAddress(wallet.address, 6, 6)})
              </span>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Receiver Stellar Address</span>
            <input
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
              placeholder="G..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white transition focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Asset</span>
            <select
              value={asset}
              onChange={(event) => setAsset(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white transition focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              {ASSET_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Amount</span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Sender Old Balance</span>
              <input
                type="number"
                min="0"
                value={fromBalance}
                onChange={(event) => setFromBalance(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Receiver Old Balance</span>
              <input
                type="number"
                min="0"
                value={toBalance}
                onChange={(event) => setToBalance(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
          </div>

          <span className="flex items-start gap-2 text-xs text-slate-500">
            Amount will be homomorphically encrypted. Never exposed on-chain.
          </span>

          {(isGeneratingProof || status?.includes("proof")) && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Generating Groth16 proof
              </div>
              <p className="text-xs text-cyan-200/80">
                Proof generated over BN254 via server API, then signed in Freighter before submission.
              </p>
            </div>
          )}

          {status && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
              {status}
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={
              !canTransfer ||
              !receiver ||
              !amount ||
              isGeneratingProof
            }
            onClick={() => void handleSubmit()}
          >
            {isGeneratingProof ? "Generating Proof..." : "Generate Proof & Sign with Freighter"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
