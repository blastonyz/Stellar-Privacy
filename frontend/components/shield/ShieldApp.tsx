"use client";

import { ComplianceAudits } from "@/components/shield/ComplianceAudits";
import { ConfidentialTransferForm } from "@/components/shield/ConfidentialTransferForm";
import { CorporateBalances } from "@/components/shield/CorporateBalances";
import { DashboardOverview } from "@/components/shield/DashboardOverview";
import { DepositForm } from "@/components/shield/DepositForm";
import { MintForm } from "@/components/shield/MintForm";
import { ProofStatusWidget } from "@/components/shield/ProofStatusWidget";
import { Sidebar } from "@/components/shield/Sidebar";
import { WalletStatusBanner } from "@/components/wallet/ConnectWalletButton";
import type { NavSection } from "@/types";
import { useState } from "react";

const titles: Record<NavSection, string> = {
  dashboard: "Overview",
  transfer: "Confidential Transfer",
  deposit: "Shield Deposit",
  mint: "Enterprise Mint",
  balances: "Corporate Balances",
  compliance: "Compliance & Audits",
};

export function ShieldApp() {
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <Sidebar active={activeSection} onNavigate={setActiveSection} />

      <div className="flex min-h-screen flex-1 flex-col">
        <WalletStatusBanner />
        <header className="border-b border-slate-800/80 px-8 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">Shield Platform</p>
          <h1 className="mt-1 text-xl font-semibold text-white">{titles[activeSection]}</h1>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-8">
          {activeSection === "dashboard" && <DashboardOverview />}
          {activeSection === "transfer" && <ConfidentialTransferForm />}
          {activeSection === "deposit" && <DepositForm />}
          {activeSection === "mint" && <MintForm />}
          {activeSection === "balances" && <CorporateBalances />}
          {activeSection === "compliance" && <ComplianceAudits />}
        </main>
      </div>

      <ProofStatusWidget />
    </div>
  );
}
