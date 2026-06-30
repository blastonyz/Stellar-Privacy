"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { shieldApi } from "@/lib/api/shield-client";
import { decryptBalanceLocal } from "@/lib/decrypt";
import { loadViewKey, saveViewKey } from "@/lib/keys/view-key-store";
import {
  extractPublicInputs,
  fetchContractEvents,
  fetchEncryptedBalance,
  fetchIsRegistered,
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
  deposit: (amount: string) => Promise<string>;
  mint: (to: string, amount: string) => Promise<string>;
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

      const babyJubSk = loadViewKey(wallet.address);
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
    setStatus("Generating register proof via Shield backend...");
    try {
      const payload = await shieldApi.register(wallet.address);
      saveViewKey(wallet.address, payload.babyJub.sk);
      setStatus("Save your view key locally. Sign registration in Freighter...");
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
      const babyJubSk = loadViewKey(wallet.address);
      if (!babyJubSk) {
        throw new Error("Missing view key. Register on-chain first.");
      }

      setStatus("Generating transfer proof via Shield backend...");
      try {
        const payload = await shieldApi.transfer({
          from: wallet.address,
          to: input.to,
          amount: input.amount,
          babyJubSk,
          fromBalance: input.fromBalance,
          toBalance: input.toBalance,
        });

        if (payload.publicInputs) {
          setPublicInputs(payload.publicInputs as PublicInputs);
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

  const deposit = useCallback(
    async (amount: string) => {
      if (!wallet.address) throw new Error("Connect Freighter first");
      setStatus("Generating deposit proof via Shield backend...");
      try {
        const payload = await shieldApi.deposit({ user: wallet.address, amount });
        setStatus("Please sign deposit in Freighter...");
        const result = await signAndSubmit(payload.unsignedXdr, wallet.sign);
        setStatus(`Deposit submitted. Tx: ${result.hash}`);
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

  const mint = useCallback(
    async (to: string, amount: string) => {
      if (!wallet.address) throw new Error("Connect Freighter first");
      setStatus("Generating mint proof via Shield backend...");
      try {
        const payload = await shieldApi.mint({
          admin: wallet.address,
          to,
          amount,
        });
        setStatus("Please sign mint in Freighter (admin)...");
        const result = await signAndSubmit(payload.unsignedXdr, wallet.sign);
        setStatus(`Mint submitted. Tx: ${result.hash}`);
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
    const viewKey = loadViewKey(wallet.address);
    if (!viewKey) {
      throw new Error("Missing view key for decryption");
    }

    const balance = await decryptBalanceLocal(account.encryptedBalance, viewKey);
    setAccount((current) => ({ ...current, decryptedBalance: balance }));
    return balance;
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
      deposit,
      mint,
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
      deposit,
      mint,
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
