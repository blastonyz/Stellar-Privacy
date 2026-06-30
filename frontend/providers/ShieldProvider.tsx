"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import {
  extractPublicInputs,
  fetchContractEvents,
  fetchEncryptedBalance,
  fetchIsRegistered,
  loadBabyJubSecret,
  saveBabyJubSecret,
} from "@/lib/shield-protocol";
import { signAndSubmit } from "@/lib/transactions";
import type { ContractEvent, PublicInputs, ShieldAccountState } from "@/types";

type ShieldContextValue = {
  wallet: ReturnType<typeof useFreighter>;
  account: ShieldAccountState;
  events: ContractEvent[];
  publicInputs: PublicInputs | null;
  loading: boolean;
  status: string | null;
  refresh: () => Promise<void>;
  register: () => Promise<void>;
  transfer: (input: {
    to: string;
    amount: string;
    fromBalance?: string;
    toBalance?: string;
  }) => Promise<string>;
  decryptLocalBalance: () => Promise<string | null>;
};

const ShieldContext = createContext<ShieldContextValue | null>(null);

export function ShieldProvider({ children }: { children: React.ReactNode }) {
  const wallet = useFreighter();
  const [account, setAccount] = useState<ShieldAccountState>({
    registered: false,
    encryptedBalance: null,
    decryptedBalance: null,
    babyJubSk: null,
  });
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [publicInputs, setPublicInputs] = useState<PublicInputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.address) {
      setAccount({
        registered: false,
        encryptedBalance: null,
        decryptedBalance: null,
        babyJubSk: null,
      });
      setEvents([]);
      setPublicInputs(null);
      return;
    }

    setLoading(true);
    try {
      const [registered, encryptedBalance, contractEvents] = await Promise.all([
        fetchIsRegistered(wallet.address, wallet.address),
        fetchEncryptedBalance(wallet.address, wallet.address),
        fetchContractEvents(25),
      ]);

      const babyJubSk = loadBabyJubSecret(wallet.address);
      setAccount({
        registered,
        encryptedBalance,
        decryptedBalance: null,
        babyJubSk,
      });
      setEvents(contractEvents);
      setPublicInputs(extractPublicInputs(contractEvents));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const register = useCallback(async () => {
    if (!wallet.address) throw new Error("Connect Freighter first");
    setStatus("Generating register proof...");
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Register build failed");

      saveBabyJubSecret(wallet.address, payload.babyJub.sk);
      setStatus("Please sign registration in Freighter...");
      const result = await signAndSubmit(payload.unsignedXdr, wallet.sign);
      setStatus(`Registered successfully. Tx: ${result.hash}`);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message);
      throw error;
    }
  }, [refresh, wallet]);

  const transfer = useCallback(
    async (input: { to: string; amount: string; fromBalance?: string; toBalance?: string }) => {
      if (!wallet.address) throw new Error("Connect Freighter first");
      const babyJubSk = loadBabyJubSecret(wallet.address);
      if (!babyJubSk) {
        throw new Error("Missing BabyJub secret. Register on-chain first.");
      }

      setStatus("Generating transfer proof...");
      try {
        const response = await fetch("/api/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: wallet.address,
            to: input.to,
            amount: input.amount,
            babyJubSk,
            fromBalance: input.fromBalance,
            toBalance: input.toBalance,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Transfer build failed");

        if (payload.publicInputs) {
          setPublicInputs(payload.publicInputs);
        }

        setStatus("Please sign transfer in Freighter...");
        const result = await signAndSubmit(payload.unsignedXdr, wallet.sign);
        setStatus(`Transfer submitted. Tx: ${result.hash}`);
        await refresh();
        return result.hash;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(message);
        throw error;
      }
    },
    [refresh, wallet],
  );

  const decryptLocalBalance = useCallback(async () => {
    if (!wallet.address || !account.encryptedBalance) return null;
    const babyJubSk = loadBabyJubSecret(wallet.address);
    if (!babyJubSk) {
      throw new Error("Missing BabyJub secret for decryption");
    }

    const response = await fetch("/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyJubSk,
        encryptedBalance: account.encryptedBalance,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Decrypt failed");

    setAccount((current) => ({ ...current, decryptedBalance: payload.balance }));
    return payload.balance as string;
  }, [account.encryptedBalance, wallet.address]);

  const value = useMemo(
    () => ({
      wallet,
      account,
      events,
      publicInputs,
      loading,
      status,
      refresh,
      register,
      transfer,
      decryptLocalBalance,
    }),
    [
      wallet,
      account,
      events,
      publicInputs,
      loading,
      status,
      refresh,
      register,
      transfer,
      decryptLocalBalance,
    ],
  );

  return <ShieldContext.Provider value={value}>{children}</ShieldContext.Provider>;
}

export function useShield() {
  const context = useContext(ShieldContext);
  if (!context) {
    throw new Error("useShield must be used within ShieldProvider");
  }
  return context;
}
