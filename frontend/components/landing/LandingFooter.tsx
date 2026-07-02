import Link from "next/link";
import { ShieldLogo } from "@/components/landing/ShieldLogo";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/8 bg-shield-black px-5 py-12 md:px-14">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-3 text-white/45">
          <ShieldLogo className="h-5 w-5 opacity-80" />
          <span className="text-xs tracking-wide">Shield · Encrypted Stellar · AGPL-3.0</span>
        </div>
        <Link
          href="/app"
          className="text-sm font-medium text-shield-yellow transition hover:text-white"
        >
          Open dashboard →
        </Link>
      </div>
    </footer>
  );
}
