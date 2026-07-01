import { Building2, Coins, SendHorizontal, Server } from "lucide-react";

const features = [
  {
    icon: SendHorizontal,
    title: "Confidential transfer",
    description:
      "B2B settlement with encrypted sender and receiver balances. Groth16 proof binds to on-chain ciphertext hashes.",
  },
  {
    icon: Coins,
    title: "Enterprise mint",
    description:
      "Admin-minted encrypted supply for demo institutions. Freighter-signed, verifier-checked mint proofs.",
  },
  {
    icon: Building2,
    title: "Corporate balances",
    description:
      "Decrypt shielded holdings locally. Dashboard activity from Soroban events — amounts stay private.",
  },
  {
    icon: Server,
    title: "Prover on Cloud Run",
    description:
      "Witness + prove on the backend; Freighter signs unsigned XDR. Frontend on Vercel, keys stay with you.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-slate-800/60 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">Platform</p>
          <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
            Built for regulated B2B flows
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Register, mint, transfer, and audit — modular dashboard sections for each step of the
            shielded lifecycle.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group rounded-xl border border-slate-800/80 bg-slate-900/30 p-6 transition hover:border-cyan-500/20 hover:bg-slate-900/50"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20 transition group-hover:bg-cyan-500/15">
                <Icon className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-base font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
