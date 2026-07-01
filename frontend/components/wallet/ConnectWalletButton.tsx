"use client";

import { Button } from "@/components/ui/Button";
import { useShield } from "@/providers/ShieldProvider";
import { shortAddress } from "@/lib/utils";

export function ConnectWalletButton() {
  const { wallet } = useShield();
  const { connected, address, network, networkMismatch, expectedNetwork, connect, disconnect, refresh } =
    wallet;

  if (connected && address && !networkMismatch) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-mono text-xs text-slate-200">{shortAddress(address, 6, 6)}</p>
          <p className="text-[10px] text-slate-500">{network ?? "Unknown network"}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  if (connected && address && networkMismatch) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[10px] text-amber-200">
          Freighter is on {network ?? "another network"}. Switch to {expectedNetwork}.
        </p>
        <Button size="sm" variant="secondary" onClick={() => void refresh()}>
          Recheck network
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => void connect().catch(console.error)}>
      Connect Freighter
    </Button>
  );
}

export function WalletStatusBanner() {
  const { wallet } = useShield();
  if (!wallet.networkMismatch) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-500/30 bg-amber-500/10 px-8 py-2 text-xs text-amber-200">
      <span>
        Freighter network does not match this app ({wallet.expectedNetwork} required). Switch Freighter
        to {wallet.expectedNetwork} — the page updates automatically within a few seconds.
      </span>
      <Button size="sm" variant="secondary" onClick={() => void wallet.refresh()}>
        Recheck now
      </Button>
    </div>
  );
}
