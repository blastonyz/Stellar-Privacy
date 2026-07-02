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
    <section id="features" className="relative border-t border-shield-violet/20 px-5 py-24 md:px-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(90,35,207,0.18),transparent_70%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-shield-yellow">
            Platform
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-white md:text-4xl">
            Built for regulated B2B flows
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Register, mint, transfer, and audit — modular dashboard sections for each step of the
            shielded lifecycle.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group rounded-2xl border border-white/8 bg-white/[0.03] p-7 backdrop-blur-sm transition hover:border-shield-violet/40 hover:bg-shield-violet/[0.06]"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-shield-violet/30 bg-shield-violet/15 transition group-hover:border-shield-yellow/40 group-hover:bg-shield-yellow/10">
                <Icon className="h-5 w-5 text-shield-yellow transition group-hover:text-shield-yellow" />
              </div>
              <h3 className="text-lg font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
