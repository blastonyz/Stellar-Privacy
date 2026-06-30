"use client";

import { ShieldProvider } from "@/providers/ShieldProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ShieldProvider>{children}</ShieldProvider>;
}
