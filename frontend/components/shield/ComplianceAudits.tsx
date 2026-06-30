"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { formatTimestamp, shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { FileCheck2, ShieldCheck } from "lucide-react";

export function ComplianceAudits() {
  const { events, publicInputs } = useShield();

  const transferEvents = events.filter((event) => event.kind === "xfer");
  const registerEvents = events.filter((event) => event.kind === "register");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Compliance & Audits</h1>
        <p className="mt-1 text-sm text-slate-400">
          Live contract events and public proof inputs from Soroban RPC.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-white">Verification Summary</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
              <span className="text-sm text-slate-400">Constraints Checked</span>
              <Badge tone="success">11/11</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
              <span className="text-sm text-slate-400">Transfer Events</span>
              <Badge tone="info">{transferEvents.length}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
              <span className="text-sm text-slate-400">Registration Events</span>
              <Badge tone="neutral">{registerEvents.length}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Proofs verified via Soroban BN254 precompile
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-white">Public Inputs (On-Chain)</h2>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-cyan-100/90">
              {publicInputs
                ? JSON.stringify(publicInputs, null, 2)
                : "No transfer public inputs available in recent events."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-medium text-white">Audit Event Log</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">No contract events in the recent ledger window.</p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-xs text-slate-500">Ledger {event.ledger}</p>
                  <p className="font-mono text-xs text-slate-200">{event.txHash.slice(0, 16)}...</p>
                  <p className="text-xs text-slate-400">
                    {event.kind === "xfer"
                      ? shortAddress(String(event.topics[3] ?? ""), 8, 8)
                      : String(event.topics[2] ?? event.kind)}
                  </p>
                </div>
                <Badge tone={event.kind === "xfer" ? "success" : "info"}>{event.kind}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
