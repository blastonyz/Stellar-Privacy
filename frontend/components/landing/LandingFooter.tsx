import Link from "next/link";
import { Shield } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-800/60 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-slate-500">
          <Shield className="h-4 w-4 text-slate-600" />
          <span className="text-xs">Shield · Encrypted Stellar · AGPL-3.0</span>
        </div>
        <Link href="/app" className="text-xs text-cyan-400/90 transition hover:text-cyan-300">
          Open dashboard →
        </Link>
      </div>
    </footer>
  );
}
