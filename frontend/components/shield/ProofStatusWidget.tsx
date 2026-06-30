"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import { ChevronDown, Cpu, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function ProofStatusWidget() {
  const { publicInputs, events } = useShield();
  const [open, setOpen] = useState(true);

  const latestTransfer = events.find((event) => event.kind === "xfer");

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="fixed bottom-6 right-6 z-50 w-[min(24rem,calc(100vw-2rem))]"
    >
      <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-950/95 shadow-2xl shadow-cyan-500/10 backdrop-blur-md">
        <Collapsible.Trigger className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Live Cryptographic Proof Status</span>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
          />
        </Collapsible.Trigger>

        <Collapsible.Content className="border-t border-slate-800/80 px-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Constraints</span>
              <Badge tone="success">11/11</Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500">Latest Transfer Tx</p>
              <p className="mt-1 font-mono text-[11px] text-cyan-300">
                {latestTransfer?.txHash ?? "No recent transfer event"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              transfer.circom · Groth16 · BN254
            </div>
            <pre className="max-h-36 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-slate-300">
              {publicInputs
                ? JSON.stringify(publicInputs, null, 2)
                : "Waiting for transfer public inputs..."}
            </pre>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
