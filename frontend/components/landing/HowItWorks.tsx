import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Connect & register",
    body: "Freighter on Stellar testnet. Generate a BabyJub view key; save the backup in your browser.",
  },
  {
    step: "02",
    title: "Mint or deposit",
    body: "Admin mints encrypted supply, or deposit public units into your shielded balance.",
  },
  {
    step: "03",
    title: "Transfer privately",
    body: "Backend builds the Groth16 proof; you sign in Freighter. Counterparty must be registered.",
  },
  {
    step: "04",
    title: "Decrypt locally",
    body: "Dashboard reveals balances with your view key only — never sent to the prover API.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-slate-800/60 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">Flow</p>
        <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">How Shield works</h2>

        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, title, body }) => (
            <li key={step} className="relative rounded-xl border border-slate-800/80 bg-slate-950/50 p-5">
              <span className="font-mono text-xs text-cyan-500/80">{step}</span>
              <h3 className="mt-2 text-sm font-medium text-white">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-600/5 px-8 py-10 md:flex-row">
          <div>
            <h3 className="text-lg font-medium text-white">Ready to try a shielded transfer?</h3>
            <p className="mt-1 text-sm text-slate-400">
              Open the dashboard — register, mint, and settle with your demo counterparty.
            </p>
          </div>
          <Link href="/app">
            <Button size="lg" className="shrink-0 gap-2">
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
