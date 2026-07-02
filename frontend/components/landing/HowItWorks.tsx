import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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
    <section id="how-it-works" className="border-t border-white/8 px-5 py-24 md:px-14">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-shield-yellow">Flow</p>
        <h2 className="mt-3 text-3xl font-medium tracking-tight text-white md:text-4xl">
          How Shield works
        </h2>

        <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, title, body }) => (
            <li
              key={step}
              className="relative rounded-2xl border border-white/8 bg-white/[0.02] p-6 transition hover:border-shield-violet/35"
            >
              <span className="font-mono text-xs text-shield-violet">{step}</span>
              <h3 className="mt-3 text-base font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 flex flex-col items-start justify-between gap-8 rounded-2xl border border-shield-violet/30 bg-gradient-to-br from-shield-violet/15 to-black px-8 py-10 md:flex-row md:items-center">
          <div>
            <h3 className="text-xl font-medium text-white">Ready to try a shielded transfer?</h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
              Open the dashboard — register, mint, and settle with your demo counterparty on live
              testnet.
            </p>
          </div>
          <Link
            href="/app"
            className="inline-flex shrink-0 items-center gap-2 rounded-[9px] bg-shield-yellow px-6 py-3.5 text-sm font-bold text-black shadow-[0_8px_24px_rgba(253,210,19,0.22)] transition hover:-translate-y-px"
          >
            Go to dashboard
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
