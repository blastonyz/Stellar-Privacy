import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.06),_transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <LandingNav />
      <main>
        <HeroSection />
        <FeatureGrid />
        <HowItWorks />
      </main>
      <LandingFooter />
    </div>
  );
}
