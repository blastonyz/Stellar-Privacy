import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Shield",
  description: "Institutional confidential payments on Stellar Soroban.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
