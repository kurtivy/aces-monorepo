import { useAccount, useDisconnect } from "wagmi";

/**
 * Wallet connection hook.
 *
 * Connection is handled by WalletModal (Radix Dialog with connector selection).
 * This hook provides account state and disconnect only.
 */
export function useWallet() {
  const { address, isConnected, chain, chainId, status } = useAccount();
  const { disconnect } = useDisconnect();

  return {
    address,
    isConnected,
    chain,
    chainId,
    status,
    disconnect,
  };
}
