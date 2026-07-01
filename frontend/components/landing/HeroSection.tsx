import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { ArrowRight, Eye, Lock, ShieldCheck, Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-16 md:pb-32 md:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <Badge tone="info" className="mb-6 inline-flex gap-1.5 px-3 py-1">
          <Sparkles className="h-3 w-3" />
          Stellar Soroban · Testnet MVP
        </Badge>

        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl md:leading-[1.1]">
          Institutional payments
          <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            without exposing balances
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
          Shield combines Twisted ElGamal commitments on BabyJubJub with BN254 Groth16 proofs
          verified on-chain. Amounts stay encrypted — only you decrypt locally with your view key.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/app">
            <Button size="lg" className="min-w-[180px] gap-2">
              Launch dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button size="lg" variant="secondary" className="min-w-[180px]">
              See how it works
            </Button>
          </a>
        </div>

        <ul className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              icon: Lock,
              title: "Homomorphic balances",
              text: "Ciphertext updated on-chain; plaintext never published.",
            },
            {
              icon: ShieldCheck,
              title: "Groth16 verified",
              text: "Every transfer proved against on-chain verification keys.",
            },
            {
              icon: Eye,
              title: "Local decrypt only",
              text: "View key in your browser — not sent to the prover server.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm"
            >
              <Icon className="mb-3 h-5 w-5 text-cyan-400" />
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
