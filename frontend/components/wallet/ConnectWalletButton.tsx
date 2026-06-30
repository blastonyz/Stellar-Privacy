"use client";

import { Button } from "@/components/ui/Button";
import { useShield } from "@/providers/ShieldProvider";
import { shortAddress } from "@/lib/utils";

export function ConnectWalletButton() {
  const { wallet } = useShield();
  const { connected, address, network, networkMismatch, connect, disconnect } = wallet;

  if (connected && address) {
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
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-8 py-2 text-xs text-amber-200">
      Freighter network does not match app configuration. Switch Freighter to Testnet.
    </div>
  );
}
