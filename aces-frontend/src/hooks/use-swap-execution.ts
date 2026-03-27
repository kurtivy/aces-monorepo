/**
 * React hook for executing DEX swaps.
 *
 * Wraps the dex-swap-service with React state management (loading, error, txHash).
 * Handles approval → simulation → execution → confirmation automatically.
 */

import { useState, useCallback } from "react";
import type { Address } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { CHAIN_ID } from "~/lib/contracts/addresses";
import { executeSwap, type StatusCallback } from "~/lib/swap/dex-swap-service";
import type { SwapRoute, TransactionResult } from "~/lib/swap/types";

interface UseSwapExecutionResult {
  /** Trigger the swap. Returns the TransactionResult when done. */
  execute: (params: {
    route: SwapRoute;
    slippageBps: number;
  }) => Promise<TransactionResult>;
  /** Human-readable status message during execution (e.g. "Approving...", "Confirming swap...") */
  status: string;
  /** Error message if the swap failed */
  error: string | null;
  /** Transaction hash on success */
  txHash: string | null;
  /** Whether a swap is currently in progress */
  isExecuting: boolean;
  /** Reset state to allow another swap */
  reset: () => void;
}

export function useSwapExecution(): UseSwapExecutionResult {
  const { address, chainId, isConnected, status: connectionStatus } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient, error: walletClientError } = useWalletClient({
    account: address,
    query: {
      enabled: !!address,
    },
  });

  const [swapStatus, setSwapStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const reset = useCallback(() => {
    setSwapStatus("");
    setError(null);
    setTxHash(null);
    setIsExecuting(false);
  }, []);

  const execute = useCallback(
    async (params: {
      route: SwapRoute;
      slippageBps: number;
    }): Promise<TransactionResult> => {
      if (!address || !isConnected) {
        const msg = "Connect your wallet to trade";
        setError(msg);
        return { success: false, error: msg };
      }

      if (typeof chainId === "number" && chainId !== CHAIN_ID) {
        const msg = "Switch your wallet to Base mainnet to trade";
        setError(msg);
        return { success: false, error: msg };
      }

      if (!publicClient) {
        const msg = "Base RPC unavailable. Refresh and try again.";
        setError(msg);
        return { success: false, error: msg };
      }

      if (!walletClient) {
        if (connectionStatus !== "connected") {
          const msg = "Wallet connection is still initializing. Wait a moment and try again.";
          setError(msg);
          return { success: false, error: msg };
        }

        const msg = parseWalletClientError(walletClientError);
        setError(msg);
        return { success: false, error: msg };
      }

      try {
        setIsExecuting(true);
        setError(null);
        setTxHash(null);
        setSwapStatus("Preparing swap...");

        const result = await executeSwap({
          route: params.route,
          slippageBps: params.slippageBps,
          walletAddress: address as Address,
          publicClient,
          walletClient,
          onStatus: setSwapStatus,
        });

        if (result.success && result.hash) {
          setTxHash(result.hash);
          setSwapStatus("Transaction confirmed!");
        } else {
          setError(result.error ?? "Swap failed");
          setSwapStatus("");
        }

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Swap failed";
        setError(msg);
        setSwapStatus("");
        return { success: false, error: msg };
      } finally {
        setIsExecuting(false);
      }
    },
    [
      address,
      chainId,
      connectionStatus,
      isConnected,
      publicClient,
      walletClient,
      walletClientError,
    ],
  );

  return { execute, status: swapStatus, error, txHash, isExecuting, reset };
}

function parseWalletClientError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Wallet is connected, but signing is unavailable. Reconnect and try again.";
  }

  const message = error.message.toLowerCase();
  if (message.includes("chain mismatch")) {
    return "Switch your wallet to Base mainnet to trade";
  }
  if (message.includes("not connected")) {
    return "Connect your wallet to trade";
  }
  return "Wallet is connected, but signing is unavailable. Reconnect and try again.";
}
