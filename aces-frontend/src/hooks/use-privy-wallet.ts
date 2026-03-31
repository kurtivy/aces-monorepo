import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Wallet connection hook — bridges Privy auth state with wagmi account.
 *
 * Privy handles authentication (wallet connect, email login, embedded wallets).
 * The Privy WagmiProvider bridges the active Privy wallet into wagmi, so
 * `useAccount()` returns the correct address/chain. Disconnection uses
 * Privy's `logout()` which clears both the Privy session and wagmi state.
 *
 * Consumers use this instead of raw useAccount/usePrivy to get a unified API.
 */
export function useWallet() {
  // wagmi account state — populated by the Privy wagmi adapter
  const { address, isConnected, chain, chainId, status } = useAccount();

  // Privy auth state — handles login/logout lifecycle
  const { ready, authenticated, user, logout } = usePrivy();

  return {
    // ── Connection state (from wagmi, bridged by Privy) ──
    address,
    isConnected,
    chain,
    chainId,
    status,

    // ── Auth state (from Privy) ──
    /** Whether Privy has finished initializing */
    ready,
    /** Whether the user has an active Privy session */
    authenticated,
    /** Privy user object — includes wallet address, email, etc. */
    user,

    // ── Actions ──
    /** Disconnect wallet AND clear Privy session */
    disconnect: logout,
  };
}
