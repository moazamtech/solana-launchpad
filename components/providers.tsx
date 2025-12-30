"use client";

import { useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

// Network configuration with fallback
function getNetwork(): Cluster {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (
    network === "mainnet-beta" ||
    network === "testnet" ||
    network === "devnet"
  ) {
    return network;
  }
  return "devnet"; // Safe default
}

function getEndpoint(): string {
  const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (customRpc && customRpc.startsWith("http")) {
    return customRpc;
  }
  return clusterApiUrl(getNetwork());
}

export default function Providers({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const endpoint = useMemo(() => {
    const ep = getEndpoint();
    console.log("Solana RPC Endpoint:", ep);
    return ep;
  }, []);

  // Initialize wallets with useMemo to prevent recreation
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  // Error handler for wallet errors
  const onError = useCallback((error: Error) => {
    console.error("Wallet error:", error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
