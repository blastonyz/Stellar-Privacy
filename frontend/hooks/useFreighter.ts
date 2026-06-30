"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { stellarConfig, networkLabel } from "@/lib/stellar";

export function useFreighter() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setError(null);
    const { isConnected: installed, error: connError } = await isConnected();
    if (connError || !installed) {
      setConnected(false);
      setAddress(null);
      setNetwork(null);
      return;
    }

    const { address: addr, error: addressError } = await getAddress();
    if (addressError || !addr) {
      setConnected(false);
      setAddress(null);
      return;
    }

    const { network: net, error: networkError } = await getNetwork();
    if (networkError) {
      setError(networkError.message);
      return;
    }

    setConnected(true);
    setAddress(addr);
    setNetwork(net ?? null);
    setNetworkMismatch(net !== stellarConfig.networkPassphrase);
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const connect = useCallback(async () => {
    setError(null);
    const { isConnected: installed, error: connError } = await isConnected();
    if (connError || !installed) {
      throw new Error("Freighter extension not installed");
    }

    const { address: addr, error: accessError } = await requestAccess();
    if (accessError) throw new Error(accessError.message);

    const { network: net, error: networkError } = await getNetwork();
    if (networkError) throw new Error(networkError.message);

    setConnected(true);
    setAddress(addr);
    setNetwork(net ?? null);
    setNetworkMismatch(net !== stellarConfig.networkPassphrase);
    return addr;
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setNetwork(null);
    setNetworkMismatch(false);
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!connected) throw new Error("Wallet not connected");
      const { signedTxXdr, error: signError } = await signTransaction(xdr, {
        networkPassphrase: stellarConfig.networkPassphrase,
      });
      if (signError) throw new Error(signError.message);
      return signedTxXdr;
    },
    [connected],
  );

  return {
    connected,
    address,
    network: network ? networkLabel(network) : null,
    networkMismatch,
    error,
    connect,
    disconnect,
    sign,
    refresh: checkConnection,
  };
}
