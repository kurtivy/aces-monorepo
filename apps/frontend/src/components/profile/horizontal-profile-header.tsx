'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Wallet, Headset } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AdminButton } from './admin-button';
import { NotificationBell } from '@/components/ui/custom/notification-bell';
import { useAuth } from '@/lib/auth/auth-context';
import { useSwapContracts } from '@/hooks/swap/use-swap-contracts';
import { useTokenBalances } from '@/hooks/swap/use-token-balances';
import { ConciergeServiceModal } from './concierge-service-modal';
import { ListingsApi } from '@/lib/api/listings';
import { TokensApi } from '@/lib/api/tokens';

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
  const [isConciergeModalOpen, setIsConciergeModalOpen] = useState(false);
  const [feesLoading, setFeesLoading] = useState(false);
  const [totalFeesUsd, setTotalFeesUsd] = useState<number>(0);
  const [totalFeesAces, setTotalFeesAces] = useState<number>(0);

  // Get auth state and wallet info
  const { walletAddress, isAuthenticated, getAccessToken } = useAuth();

  // Initialize contracts for balance fetching
  const contracts = useSwapContracts(walletAddress, isAuthenticated);
  const { signer, acesContract } = contracts;

  // Fetch ACES balance
  const balances = useTokenBalances({
    acesContract,
    tokenContract: null,
    signer,
    chainId: 84532,
  });

  const { acesBalance, loading: balancesLoading } = balances;

  // Determine account status: show role
  const getAccountStatus = () => {
    return user.role || 'TRADER';
  };

  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (user.walletAddress) {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch ACES USD price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || 'https://acesbackend-production.up.railway.app';
        const res = await fetch(`${baseUrl}/api/v1/prices/aces-usd`);
        if (res.ok) {
          const data = await res.json();
          const price = data?.data?.acesUsdPrice ?? data?.price ?? null;
          if (price) {
            setAcesUsdPrice(parseFloat(price));
          }
        }
      } catch (error) {
        console.error('Failed to fetch ACES price:', error);
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
  const formattedFeesUsd = `$${totalFeesUsd.toFixed(2)}`;
  const formattedFeesAces = `${totalFeesAces.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} ACES`;

  const walletUsernameSeed = user.walletAddress ? user.walletAddress.slice(2, 9).toUpperCase() : '';
  const hasCustomUsername = Boolean(user.username && user.username.trim());
  const usernameValue = hasCustomUsername ? (user.username || '').trim() : walletUsernameSeed;

  // Fetch total fees across all of the user's live tokens (bonding + DEX)
  useEffect(() => {
    let cancelled = false;

    const fetchFees = async () => {
      // Only attempt when authenticated with a connected wallet
      if (!walletAddress || !isAuthenticated) {
        setTotalFeesUsd(0);
        setTotalFeesAces(0);
        return;
      }

      setFeesLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled) {
            setTotalFeesUsd(0);
            setTotalFeesAces(0);
          }
          return;
        }

        const listingsResp = await ListingsApi.getMyListings(token);
        if (!listingsResp.success) {
          throw new Error(listingsResp.error || 'Failed to fetch listings');
        }

        // Collect unique contract addresses for minted/live tokens
        const addresses = Array.from(
          new Set(
            listingsResp.data
              .map((listing) => listing?.contractAddress || listing?.token?.contractAddress)
              .filter((addr): addr is string => typeof addr === 'string' && addr.length > 0),
          ),
        );

        if (addresses.length === 0) {
          if (!cancelled) {
            setTotalFeesUsd(0);
            setTotalFeesAces(0);
          }
          return;
        }

        const metricsResults = await Promise.all(
          addresses.map(async (addr) => {
            const resp = await TokensApi.getTokenMetrics(addr);
            if (resp.success && resp.data) {
              const aces = parseFloat(resp.data.totalFeesAces || '0');
              const usd = Number.isFinite(resp.data.totalFeesUsd) ? resp.data.totalFeesUsd : 0;
              return { aces, usd };
            }
            return { aces: 0, usd: 0 };
          }),
        );

        const aggregateAces = metricsResults.reduce((sum, m) => sum + m.aces, 0);
        const aggregateUsd = metricsResults.reduce((sum, m) => sum + (m.usd || 0), 0);

        if (!cancelled) {
          setTotalFeesAces(aggregateAces);
          setTotalFeesUsd(aggregateUsd);
        }
      } catch (error) {
        console.error('Failed to fetch total fees for profile header:', error);
        if (!cancelled) {
          setTotalFeesUsd(0);
          setTotalFeesAces(0);
        }
      } finally {
        if (!cancelled) {
          setFeesLoading(false);
        }
      }
    };

    fetchFees();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, getAccessToken]);

  return (
    <>
      <div
        data-profile-header
        className="relative bg-[#0f1511] rounded-b-xl p-6 border-b border-dashed border-[#E6E3D3]/25"
      >
        <div className="absolute top-4 right-4">
          <NotificationBell />
        </div>
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
                {user.walletAddress ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                      <div className="text-[#E6E3D3] text-xl font-semibold truncate md:text-2xl">
                        {shortenAddress(user.walletAddress)}
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsConciergeModalOpen(true)}
                      className="w-full bg-black/70 border-[#D0B284]/40 text-[#D0B284] transition-colors font-mono hover:bg-black/50 hover:border-[#D0B284]/60 sm:w-auto"
                    >
                      <Headset className="w-4 h-4 mr-2" />
                      Concierge Service
                    </Button>
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

            <div className="pt-2">
              {user.walletAddress && (
                <div className="text-[#D0B284] text-sm font-mono">
                  You are earning 0.5% fees per trade
                </div>
              )}
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
              ) : !user.walletAddress ? (
                <div className="text-sm text-[#DCDDCC]/70 text-center">
                  Connect your wallet to view portfolio balance.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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

                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-[#D7BF75] text-[11px] uppercase tracking-[0.3em]">
                      Fees Made
                    </div>
                    <div className="text-2xl font-semibold text-[#E6E3D3]">
                      {feesLoading ? '...' : formattedFeesUsd}
                    </div>
                    {!feesLoading && totalFeesAces > 0 ? (
                      <div className="text-xs text-[#DCDDCC]/70">{formattedFeesAces}</div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConciergeServiceModal
        isOpen={isConciergeModalOpen}
        onClose={() => setIsConciergeModalOpen(false)}
      />
    </>
  );
}
