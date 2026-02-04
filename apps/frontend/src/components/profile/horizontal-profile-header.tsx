'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { useSwapContracts } from '@/hooks/swap/use-swap-contracts';
import { useTokenBalances } from '@/hooks/swap/use-token-balances';

interface HorizontalProfileHeaderProps {
  user: {
    email: string | undefined;
    walletAddress: string | undefined;
    role?: string;
    username?: string | null;
  };
  onConnectWallet?: () => Promise<void>;
  onUpdateAccount?: (payload: { email: string; username: string }) => Promise<void>;
}

export function HorizontalProfileHeader({ user, onConnectWallet }: HorizontalProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [acesUsdPrice, setAcesUsdPrice] = useState<number | null>(null);

  // Get auth state and wallet info: use live connected wallet from Privy, not DB profile
  const { walletAddress: connectedWallet, isAuthenticated } = useAuth();
  const displayAddress = connectedWallet ?? user.walletAddress ?? undefined;

  // Initialize contracts for balance fetching (use connected wallet)
  const contracts = useSwapContracts(connectedWallet, isAuthenticated);
  const { signer, acesContract } = contracts;

  // Fetch ACES balance for the connected wallet
  const balances = useTokenBalances({
    acesContract,
    tokenContract: null,
    signer,
    chainId: 8453,
  });

  const { acesBalance, loading: balancesLoading } = balances;

  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (displayAddress) {
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch ACES USD price (use same-origin API to avoid connection refused when backend is down)
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/prices/aces-usd', {
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          const price = data?.data?.acesUsdPrice ?? data?.price ?? null;
          if (price != null) {
            setAcesUsdPrice(parseFloat(String(price)));
          }
        }
      } catch (_error) {
        // Silently ignore - price will show $0.00 when backend/price service unavailable
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Calculate values for display
  const acesBalanceNum = parseFloat(acesBalance || '0');
  const usdValue = acesUsdPrice ? acesBalanceNum * acesUsdPrice : 0;

  const formattedAcesBalance = Math.floor(acesBalanceNum).toLocaleString('en-US');
  const formattedUsdValue = `$${usdValue.toFixed(2)}`;

  return (
    <>
      <div
        data-profile-header
        className="relative bg-[#0f1511] rounded-b-xl p-6 border-b border-dashed border-[#E6E3D3]/25"
      >
        {/* Corner ticks */}
        {/* Top corner ticks removed to let the solid band line act as top border */}
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        <div className="flex flex-col md:flex-row md:items-start md:justify-center gap-8">
          <div className="min-w-0 space-y-4 md:basis-[58%]">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {displayAddress ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                      <div className="text-[#E6E3D3] text-xl font-semibold truncate md:text-2xl">
                        {shortenAddress(displayAddress)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 text-[#D0B284] hover:bg-[#D0B284]/10"
                        onClick={handleCopyAddress}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </>
                ) : (
                  <motion.button
                    className="flex w-full items-center justify-center rounded-md border border-[#D0B264]/30 bg-black/80 px-4 py-2 font-mono text-[#D0B264] transition-colors duration-150 hover:bg-black/70 hover:text-[#D0B264] sm:w-auto whitespace-nowrap"
                    onClick={onConnectWallet}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <div className="w-full md:max-w-[640px] md:pr-12">
            <div className="bg-black/30 border border-[#D0B284]/20 rounded-xl px-6 py-5 backdrop-blur-sm">
              {balancesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
                  {[0, 1].map((index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-2 bg-[#D0B284]/10 rounded" />
                      <div className="h-6 bg-[#D0B284]/20 rounded" />
                    </div>
                  ))}
                </div>
              ) : !displayAddress ? (
                <div className="text-sm text-[#DCDDCC]/70 text-center">
                  Connect your wallet to view portfolio balance.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-[#D7BF75] text-[11px] uppercase tracking-[0.3em]">
                      ACES Balance
                    </div>
                    <div className="text-2xl font-semibold text-[#E6E3D3]">
                      {formattedAcesBalance}
                    </div>
                  </div>

                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-[#D7BF75] text-[11px] uppercase tracking-[0.3em]">
                      USD Value
                    </div>
                    <div className="text-2xl font-semibold text-[#E6E3D3]">{formattedUsdValue}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
