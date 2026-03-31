import { usePrivy } from "@privy-io/react-auth";

/**
 * Wallet connection trigger — opens Privy's built-in login modal.
 *
 * Privy handles the entire login flow: wallet selection (MetaMask, Rabby,
 * WalletConnect QR), email OTP, embedded wallet creation. The modal
 * appearance is configured in AppProviders via PRIVY_CONFIG (dark theme,
 * gold accent, ACES logo, wallet-first login).
 *
 * This component wraps its children and calls `login()` on click.
 * No custom Radix Dialog needed — Privy's modal is well-tested and
 * handles all edge cases.
 */
interface WalletModalProps {
  children: React.ReactNode;
}

export function WalletModal({ children }: WalletModalProps) {
  const { login } = usePrivy();

  return (
    <span
      onClick={() => login()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") login();
      }}
      style={{ cursor: "pointer" }}
    >
      {children}
    </span>
  );
}
