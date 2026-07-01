"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { networkLabel, stellarConfig } from "@/lib/stellar";

function networksMatch(passphrase: string | null | undefined): boolean {
  return !!passphrase && passphrase === stellarConfig.networkPassphrase;
}

export function useFreighter() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watcherRef = useRef<WatchWalletChanges | null>(null);

  const applyWalletState = useCallback(
    (nextAddress: string | null, nextPassphrase: string | null, isLinked: boolean) => {
      const hasAddress = Boolean(nextAddress);
      setConnected(isLinked && hasAddress);
      setAddress(hasAddress ? nextAddress : null);
      setNetworkPassphrase(nextPassphrase);
      setNetwork(nextPassphrase ? networkLabel(nextPassphrase) : null);
      setNetworkMismatch(hasAddress && !networksMatch(nextPassphrase));
    },
    [],
  );

  const checkConnection = useCallback(async () => {
    setError(null);
    const { isConnected: installed, error: connError } = await isConnected();
    if (connError || !installed) {
      applyWalletState(null, null, false);
      return;
    }

    const { address: addr, error: addressError } = await getAddress();
    if (addressError || !addr) {
      applyWalletState(null, null, false);
      return;
    }

    const { networkPassphrase: passphrase, error: networkError } = await getNetwork();
    if (networkError) {
      setError(networkError.message);
      applyWalletState(addr, null, true);
      return;
    }

    applyWalletState(addr, passphrase ?? null, true);
  }, [applyWalletState]);

  useEffect(() => {
    void checkConnection();

    const watcher = new WatchWalletChanges(2000);
    watcherRef.current = watcher;
    watcher.watch(({ address: watchedAddress, networkPassphrase: watchedPassphrase, error: watchError }) => {
      if (watchError) {
        setError(watchError.message);
        applyWalletState(null, null, false);
        return;
      }
      if (!watchedAddress) {
        applyWalletState(null, null, false);
        return;
      }
      setError(null);
      applyWalletState(watchedAddress, watchedPassphrase ?? null, true);
    });

    return () => {
      watcher.stop();
      watcherRef.current = null;
    };
  }, [applyWalletState, checkConnection]);

  const connect = useCallback(async () => {
    setError(null);
    const { isConnected: installed, error: connError } = await isConnected();
    if (connError || !installed) {
      throw new Error("Freighter extension not installed");
    }

    const { address: addr, error: accessError } = await requestAccess();
    if (accessError) throw new Error(accessError.message);

    const { networkPassphrase: passphrase, error: networkError } = await getNetwork();
    if (networkError) throw new Error(networkError.message);

    applyWalletState(addr ?? null, passphrase ?? null, true);
    return addr;
  }, [applyWalletState]);

  const disconnect = useCallback(() => {
    applyWalletState(null, null, false);
    setError(null);
  }, [applyWalletState]);

  const sign = useCallback(
    async (xdr: string) => {
      if (!connected || networkMismatch) {
        throw new Error(
          networkMismatch
            ? `Switch Freighter to ${networkLabel(stellarConfig.networkPassphrase)} before signing.`
            : "Wallet not connected",
        );
      }
      const { signedTxXdr, error: signError } = await signTransaction(xdr, {
        networkPassphrase: stellarConfig.networkPassphrase,
      });
      if (signError) throw new Error(signError.message);
      return signedTxXdr;
    },
    [connected, networkMismatch],
  );

  return {
    connected,
    address,
    network,
    networkPassphrase,
    networkMismatch,
    expectedNetwork: networkLabel(stellarConfig.networkPassphrase),
    error,
    connect,
    disconnect,
    sign,
    refresh: checkConnection,
  };
}
