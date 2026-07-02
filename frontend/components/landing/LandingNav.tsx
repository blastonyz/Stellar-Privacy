"use client";

import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { ShieldLogo } from "@/components/landing/ShieldLogo";
import Link from "next/link";

export function LandingNav() {
  return (
    <header className="relative z-50">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-6 md:px-14">
        <Link href="/" className="brand flex items-center gap-3 transition-opacity hover:opacity-90">
          <ShieldLogo className="h-[26px] w-[26px] drop-shadow-[0_0_6px_rgba(253,210,19,0.45)]" />
          <span className="font-mono text-[15px] font-semibold tracking-wide text-white">SHIELD</span>
        </Link>

        <ul className="hidden items-center gap-9 text-[13.5px] font-medium text-white/55 md:flex">
          <li>
            <a href="#features" className="transition-colors hover:text-white">
              Protocol
            </a>
          </li>
          <li>
            <a href="#features" className="transition-colors hover:text-white">
              Cryptography
            </a>
          </li>
          <li>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              Compliance
            </a>
          </li>
        </ul>

        <div className="flex items-center gap-3 md:gap-4">
          <div
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 font-mono text-[11px] tracking-wide text-white/55 backdrop-blur-md sm:flex"
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-shield-yellow shadow-[0_0_8px_#FDD213]"
              style={{ animation: "landing-pulse-dot 2.2s ease-in-out infinite" }}
            />
            Stellar Testnet
          </div>
          <div className="hidden lg:block [&_button]:border [&_button]:border-white/20 [&_button]:bg-black/20 [&_button]:text-white [&_button]:backdrop-blur-md">
            <ConnectWalletButton />
          </div>
          <Link
            href="/app"
            className="rounded-lg border border-white/15 bg-black/20 px-4 py-2 text-[13.5px] font-semibold text-white backdrop-blur-md transition hover:border-white/30 hover:bg-black/40"
          >
            Open app
          </Link>
        </div>
      </nav>
    </header>
  );
}
