import { Link, useRouterState } from "@tanstack/react-router";
import { cn, truncateAddress } from "~/lib/utils";
import { useWallet } from "~/hooks/use-privy-wallet";
import { WalletModal } from "~/components/wallet-modal";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [routerState.location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-golden-beige/10 bg-deep-charcoal/95 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6 lg:px-10">
        {/* Logo — Braah One for "ACES." + Spray Letters for "FUN" (matches original brand) */}
        <Link to="/" className="flex items-baseline gap-0">
          <span className="font-braah text-2xl text-white tracking-wide">
            ACES.
          </span>
          <span className="font-spray text-2xl text-highlight-gold">
            FUN
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/drops">Drops</NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          {/* External docs link — opens in new tab */}
          <a
            href="https://docs.aces.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-platinum-grey/75 transition-colors hover:text-golden-beige"
          >
            Docs
          </a>
          <WalletButton />
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-sm text-platinum-grey/75 transition-colors hover:text-golden-beige md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-golden-beige/8 md:hidden"
          >
            <nav className="flex flex-col gap-1 px-6 py-4">
              <MobileNavLink to="/drops">Drops</MobileNavLink>
              <MobileNavLink to="/portfolio">Portfolio</MobileNavLink>
              {/* External docs link in mobile menu */}
              <a
                href="https://docs.aces.fun"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-sm px-3 py-2.5 text-sm text-platinum-grey/75 transition-colors hover:bg-golden-beige/5 hover:text-golden-beige"
              >
                Docs ↗
              </a>
              <div className="mt-3 border-t border-golden-beige/8 pt-4">
                <WalletButton />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="text-sm text-platinum-grey/75 transition-colors hover:text-golden-beige"
      activeProps={{ className: "text-golden-beige" }}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="block rounded-sm px-3 py-2.5 text-sm text-platinum-grey/75 transition-colors hover:bg-golden-beige/5 hover:text-golden-beige"
      activeProps={{ className: "text-golden-beige bg-golden-beige/5" }}
    >
      {children}
    </Link>
  );
}

function WalletButton() {
  const { address, isConnected, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className={cn(
          "rounded-sm border border-deep-emerald/60 bg-deep-emerald/20 px-4 py-2 text-sm text-golden-beige",
          "transition-all hover:border-deep-emerald hover:shadow-emerald-glow",
        )}
      >
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <WalletModal>
      <button
        className={cn(
          "rounded-sm border border-golden-beige/30 px-4 py-2 text-sm text-golden-beige",
          "transition-all hover:border-golden-beige/60 hover:shadow-gold-glow",
        )}
      >
        Connect Wallet
      </button>
    </WalletModal>
  );
}
