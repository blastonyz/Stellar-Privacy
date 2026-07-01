"use client";

import { Button } from "@/components/ui/Button";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 transition opacity-90 hover:opacity-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-500/30">
            <Shield className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Shield</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ConnectWalletButton />
          </div>
          <Link href="/app">
            <Button size="sm" className="gap-1.5">
              Open app
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
