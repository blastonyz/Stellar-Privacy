"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { shieldApi } from "@/lib/api/shield-client";
import { decryptBalanceLocal } from "@/lib/decrypt";
import { loadViewKey, parseViewKeyBackup, saveViewKey } from "@/lib/keys/view-key-store";
import {
  extractPublicInputs,
  fetchContractEvents,
  fetchEncryptedBalance,
  fetchIsRegistered,
} from "@/lib/shield-protocol";
import { signAndSubmit } from "@/lib/transactions";
import { formatShieldError, VIEW_KEY_REQUIRED_MESSAGE } from "@/lib/user-messages";
import type { ContractEvent, PublicInputs, ShieldAccountState } from "@/types";

type ContractFeatures = {
  deposit: boolean;
};

type ShieldContextValue = {
  wallet: ReturnType<typeof useFreighter>;
  account: ShieldAccountState;
  events: ContractEvent[];
  publicInputs: PublicInputs | null;
  features: ContractFeatures;
  loading: boolean;
  status: string | null;
  refresh: () => Promise<void>;
  register: () => Promise<void>;
  registerCounterparty: (secretKey: string) => Promise<{
    address: string;
    alreadyRegistered: boolean;
    txHash: string | null;
  }>;
  importViewKey: (raw: string) => Promise<boolean>;
  transfer: (input: { to: string; amount: string; fromBalance?: string; toBalance?: string }) => Promise<string>;
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
  const [features, setFeatures] = useState<ContractFeatures>({ deposit: false });

  const refreshFeatures = useCallback(async (caller?: string) => {
    try {
      const health = await shieldApi.health(caller);
      setFeatures(health.features ?? { deposit: false });
    } catch {
      setFeatures({ deposit: false });
    }
  }, []);

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
    void refreshFeatures(wallet.address ?? undefined);
  }, [refreshFeatures, wallet.address]);

  useEffect(() => {
    if (!wallet.address) {
      void refresh();
      return;
    }
    if (!wallet.connected || wallet.networkMismatch) {
      return;
    }
    void refresh();
  }, [refresh, wallet.address, wallet.connected, wallet.networkMismatch]);

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
      setStatus(formatShieldError(error));
    }
  }, [refresh, wallet]);

  const registerCounterparty = useCallback(async (secretKey: string) => {
    setStatus("Registering counterparty via Shield backend (testnet demo)...");
    try {
      const result = await shieldApi.registerCounterparty(secretKey);
      if (result.babyJub?.sk) {
        saveViewKey(result.address, result.babyJub.sk);
      }
      if (result.alreadyRegistered) {
        setStatus(
          result.babyJub?.sk
            ? `${result.address} is already registered — counterparty view key saved in this browser.`
            : `${result.address} is already registered on-chain.`,
        );
      } else {
        setStatus(
          `Counterparty registered. Tx: ${result.txHash}. View key saved for ${result.address.slice(0, 8)}…`,
        );
      }
      await refresh();
      return {
        address: result.address,
        alreadyRegistered: result.alreadyRegistered,
        txHash: result.txHash,
      };
    } catch (error) {
      setStatus(formatShieldError(error));
      throw error;
    }
  }, [refresh]);

  const importViewKey = useCallback(
    async (raw: string) => {
      if (!wallet.address) {
        setStatus("Connect Freighter first.");
        return false;
      }

      try {
        const trimmed = raw.trim();
        let sk: string;
        let address: string;

        if (trimmed.startsWith("{")) {
          const backup = parseViewKeyBackup(trimmed);
          address = backup.address;
          sk = backup.sk;
        } else {
          address = wallet.address;
          sk = trimmed;
        }

        if (address !== wallet.address) {
          setStatus("View key backup is for a different Stellar address.");
          return false;
        }

        saveViewKey(wallet.address, sk);
        setAccount((current) => ({ ...current, babyJubSk: sk }));
        setStatus("View key imported. You can transfer and decrypt balances.");
        return true;
      } catch (error) {
        setStatus(formatShieldError(error));
        return false;
      }
    },
    [wallet.address],
  );

  const transfer = useCallback(
    async (input: { to: string; amount: string; fromBalance?: string; toBalance?: string }) => {
      if (!wallet.address) {
        setStatus("Connect Freighter before transferring.");
        return "";
      }
      const babyJubSk = loadViewKey(wallet.address);
      if (!babyJubSk) {
        setStatus(VIEW_KEY_REQUIRED_MESSAGE);
        return "";
      }
      const toBabyJubSk = loadViewKey(input.to) ?? undefined;

      setStatus("Generating transfer proof via Shield backend...");
      try {
        const payload = await shieldApi.transfer({
          from: wallet.address,
          to: input.to,
          amount: input.amount,
          babyJubSk,
          toBabyJubSk,
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
        setStatus(formatShieldError(error));
        return "";
      }
    },
    [refresh, wallet],
  );

  const deposit = useCallback(
    async (amount: string) => {
      if (!wallet.address) {
        setStatus("Connect Freighter before depositing.");
        return "";
      }
      if (!account.registered) {
        setStatus("Register on-chain before depositing.");
        return "";
      }
      if (!features.deposit) {
        setStatus(
          "Deposit is not available on the deployed contract yet. Redeploy encrypted_token with the deposit entrypoint, run make upload-vks, and update ENCRYPTED_TOKEN_CONTRACT_ID.",
        );
        return "";
      }
      setStatus("Generating deposit proof via Shield backend...");
      try {
        const payload = await shieldApi.deposit({ user: wallet.address, amount });
        setStatus("Please sign deposit in Freighter...");
        const result = await signAndSubmit(payload.unsignedXdr, wallet.sign);
        setStatus(`Deposit submitted. Tx: ${result.hash}`);
        await refresh();
        return result.hash;
      } catch (error) {
        setStatus(formatShieldError(error));
        return "";
      }
    },
    [account.registered, features.deposit, refresh, wallet],
  );

  const mint = useCallback(
    async (to: string, amount: string) => {
      if (!wallet.address) {
        setStatus("Connect the admin Freighter wallet before minting.");
        return "";
      }
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
        setStatus(formatShieldError(error));
        return "";
      }
    },
    [refresh, wallet],
  );

  const decryptLocalBalance = useCallback(async () => {
    if (!wallet.address || !account.encryptedBalance) return null;
    const viewKey = loadViewKey(wallet.address);
    if (!viewKey) {
      setStatus(VIEW_KEY_REQUIRED_MESSAGE);
      return null;
    }

    try {
      const balance = await decryptBalanceLocal(account.encryptedBalance, viewKey);
      setAccount((current) => ({ ...current, decryptedBalance: balance }));
      setStatus(null);
      return balance;
    } catch (error) {
      setStatus(formatShieldError(error));
      return null;
    }
  }, [account.encryptedBalance, wallet.address]);

  const value = useMemo(
    () => ({
      wallet,
      account,
      events,
      publicInputs,
      features,
      loading,
      status,
      refresh,
      register,
      registerCounterparty,
      importViewKey,
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
      features,
      loading,
      status,
      refresh,
      register,
      registerCounterparty,
      importViewKey,
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
