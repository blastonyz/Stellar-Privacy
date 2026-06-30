"use client";

import { cn, shortAddress } from "@/lib/utils";
import { useShield } from "@/providers/ShieldProvider";
import type { NavSection } from "@/types";
import {
  Building2,
  LayoutDashboard,
  Scale,
  SendHorizontal,
  Shield,
  Wallet,
} from "lucide-react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

const navItems: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transfer", label: "Confidential Transfer", icon: SendHorizontal },
  { id: "balances", label: "Corporate Balances", icon: Building2 },
  { id: "compliance", label: "Compliance & Audits", icon: Scale },
];

type SidebarProps = {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
};

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { wallet, account } = useShield();
  const connected = wallet.connected && wallet.address;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/90">
      <div className="border-b border-slate-800/80 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-500/30">
            <Shield className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">Shield</p>
            <p className="text-xs text-slate-400">Institutional Confidential Payments</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/15 to-blue-600/10 text-white ring-1 ring-cyan-500/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-500")} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-800/80 px-4 py-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Wallet className="h-3.5 w-3.5" />
            Wallet Status
          </div>
          {connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <p className="text-xs text-slate-300">
                  Connected via Freighter:{" "}
                  <span className="font-mono text-slate-100">
                    {shortAddress(wallet.address!)}
                  </span>
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Registration: {account.registered ? "On-chain" : "Not registered"}
              </p>
            </div>
          ) : (
            <ConnectWalletButton />
          )}
        </div>
      </div>
    </aside>
  );
}
