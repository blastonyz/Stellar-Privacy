import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const trustChips = ["Stellar", "Soroban", "ElGamal / BN254", "Groth16"];

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100vh-88px)] flex-col items-center px-5 pb-16 pt-8 text-center md:pt-12">
      <div className="mx-auto flex max-w-[900px] flex-col items-center">
        <div className="landing-animate-rise-delay-1 mb-8 inline-flex items-center gap-2 rounded-full border border-shield-yellow/30 bg-shield-yellow/10 px-4 py-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-shield-yellow">
          <span className="h-[5px] w-[5px] rounded-full bg-shield-yellow" />
          Private transfer protocol · Stellar
        </div>

        <h1 className="landing-animate-rise-delay-2 text-[clamp(2.375rem,6vw,4.625rem)] font-medium leading-[1.07] tracking-tight text-white drop-shadow-[0_2px_40px_rgba(0,0,0,0.35)]">
          Encrypted balances.
          <br />
          <em className="font-normal not-italic text-shield-yellow">Verifiable trust.</em>
        </h1>

        <p className="landing-animate-rise-delay-3 mx-auto mt-6 max-w-[600px] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-white/65">
          Shield is a transfer standard on Stellar that encrypts every balance with{" "}
          <strong className="font-semibold text-white">additive ElGamal on BN254</strong>. Amounts
          stay invisible on-chain — yet fully auditable via{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.88em] text-white">
            view keys
          </code>{" "}
          for parties you authorize.
        </p>

        <div className="landing-animate-rise-delay-4 mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-[9px] bg-shield-yellow px-6 py-3.5 text-[14.5px] font-bold text-black shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_8px_26px_rgba(253,210,19,0.28)] transition hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_32px_rgba(253,210,19,0.38)]"
          >
            Launch dashboard
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-[9px] border border-white/25 bg-black/15 px-5 py-3.5 text-[14.5px] font-semibold text-white backdrop-blur-md transition hover:border-white/40 hover:bg-black/30"
          >
            See the specification →
          </a>
        </div>

        <div className="landing-animate-rise-delay-5 mt-14 flex flex-wrap items-center justify-center gap-6">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/35">
            Built on
          </span>
          <div className="flex flex-wrap justify-center gap-2.5">
            {trustChips.map((chip) => (
              <span
                key={chip}
                className="rounded-[7px] border border-white/10 bg-black/20 px-3 py-1.5 font-mono text-xs text-white/55 backdrop-blur-md"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-animate-rise-delay-6 mt-auto flex justify-center pt-16">
        <span
          className="block h-[34px] w-px bg-gradient-to-b from-transparent via-white/50 to-transparent"
          style={{ animation: "landing-cue-drift 2.4s ease-in-out infinite" }}
        />
      </div>
    </section>
  );
}
