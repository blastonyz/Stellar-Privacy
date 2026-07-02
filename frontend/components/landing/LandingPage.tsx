import { HeroSection } from "@/components/landing/HeroSection";
import { HeroWebGLBackground } from "@/components/landing/HeroWebGLBackground";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen bg-shield-black text-white">
      <HeroWebGLBackground />

      <div className="relative z-10">
        <LandingNav />
        <main>
          <HeroSection />
          <div className="relative bg-shield-black">
            <FeatureGrid />
            <HowItWorks />
          </div>
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
