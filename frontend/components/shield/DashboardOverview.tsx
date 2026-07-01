"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { OnboardingPanel } from "@/components/shield/OnboardingPanel";
import { ViewKeyPanel } from "@/components/shield/ViewKeyPanel";
import { formatTimestamp, shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import type { ProofStatus } from "@/types";
import { CheckCircle2, Clock3, Eye, EyeOff, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

function proofTone(status: ProofStatus): "success" | "warning" | "info" {
  if (status === "ZK-Verified") return "success";
  if (status === "Generating Client-side Proof") return "warning";
  return "info";
}

export function DashboardOverview() {
  const { wallet, account, events, loading, status, refresh, register, decryptLocalBalance } =
    useShield();
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const activity = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        timestamp: new Date().toISOString(),
        counterparty:
          event.kind === "xfer"
            ? String(event.topics[3] ?? event.topics[2] ?? "Unknown")
            : String(event.topics[2] ?? "Protocol"),
        amountLabel: "Encrypted via Twisted ElGamal / BN254",
        proofStatus: (event.kind === "xfer" ? "ZK-Verified" : "Pending") as ProofStatus,
        txHash: event.txHash,
      })),
    [events],
  );

  const pendingVerifications = activity.filter(
    (row) => row.proofStatus !== "ZK-Verified",
  ).length;

  const handleReveal = async () => {
    if (!revealed && account.decryptedBalance === null && wallet.address) {
      setBusy(true);
      try {
        await decryptLocalBalance();
      } catch (error) {
        console.error(error);
      } finally {
        setBusy(false);
      }
    }
    setRevealed((value) => !value);
  };

  const handleRegister = async () => {
    setBusy(true);
    try {
      await register();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            Live Soroban contract state via Freighter-connected account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
          <ConnectWalletButton />
        </div>
      </div>

      {!wallet.connected && (
        <Card>
          <CardContent className="text-sm text-slate-400">
            Connect Freighter to load registration status, encrypted balances, and contract events.
          </CardContent>
        </Card>
      )}

      {wallet.connected && !account.registered && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-300">
              Your Stellar account is not registered on the encrypted token contract yet.
            </p>
            <Button onClick={() => void handleRegister()} disabled={busy}>
              Register with ZK Proof
            </Button>
          </CardContent>
        </Card>
      )}

      {wallet.connected && account.registered && (
        <div className="space-y-3">
          <OnboardingPanel mode="balance" />
          <ViewKeyPanel />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Shielded Balance</p>
              <button
                type="button"
                onClick={() => void handleReveal()}
                disabled={!account.registered || !account.babyJubSk || busy}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-40"
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-3xl font-semibold text-white">
              {revealed && account.decryptedBalance !== null
                ? `${account.decryptedBalance} units`
                : "•••••••"}
            </p>
            <p className="text-xs text-slate-500">
              {account.babyJubSk
                ? "Decrypted locally with view key"
                : account.registered
                  ? "Save or import view key to reveal"
                  : "Register to enable"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Contract Events</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-semibold text-white">{events.length}</p>
              <Clock3 className="mb-1 h-5 w-5 text-amber-400" />
            </div>
            <p className="text-xs text-slate-500">{pendingVerifications} non-transfer events in window</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Registration</p>
            <div className="flex items-center gap-2">
              <Badge tone={account.registered ? "success" : "warning"}>
                {account.registered ? "Registered" : "Not Registered"}
              </Badge>
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-500">Verified via `is_registered` simulation</p>
          </CardContent>
        </Card>
      </div>

      {status && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
          {status}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-white">Recent On-Chain Activity</h2>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Event</th>
                <th className="px-6 py-3 font-medium">Counterparty / Topic</th>
                <th className="px-6 py-3 font-medium">Encrypted Amount</th>
                <th className="px-6 py-3 font-medium">Proof Status</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No contract events found in the recent ledger window.
                  </td>
                </tr>
              ) : (
                activity.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-800/50 transition hover:bg-slate-900/40"
                  >
                    <td className="px-6 py-4 text-slate-300">{row.txHash.slice(0, 10)}...</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-200">
                      {shortAddress(row.counterparty, 6, 6)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-slate-300">
                        <Lock className="h-3.5 w-3.5 text-cyan-400" />
                        {row.amountLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={proofTone(row.proofStatus)}>{row.proofStatus}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
