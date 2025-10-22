'use client';

import { useEffect, useState } from 'react';
import { Edit2, Copy, Check, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AccountEditModal } from './account-edit-modal';
import { AdminButton } from './admin-button';
import { NotificationBell } from '@/components/ui/custom/notification-bell';
import { useAuth } from '@/lib/auth/auth-context';
import { useSwapContracts } from '@/hooks/swap/use-swap-contracts';
import { useTokenBalances } from '@/hooks/swap/use-token-balances';
import { formatAmountForDisplay } from '@/lib/swap/formatters';

interface HorizontalProfileHeaderProps {
  user: {
    email: string | undefined;
    walletAddress: string | undefined;
    role?: string;
    username?: string | null;
    sellerStatus?: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  };
  onUpdateAccount?: (data: { email: string; username: string }) => Promise<void>;
  onConnectWallet?: () => Promise<void>;
}

export function HorizontalProfileHeader({
  user,
  onUpdateAccount,
  onConnectWallet,
}: HorizontalProfileHeaderProps) {
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acesUsdPrice, setAcesUsdPrice] = useState<number | null>(null);

  // Get auth state and wallet info
  const { walletAddress, isAuthenticated } = useAuth();

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

  // Determine account status: show "VERIFIED" if seller is approved, otherwise show role
  const getAccountStatus = () => {
    if (user.sellerStatus === 'APPROVED') {
      return 'VERIFIED';
    }
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

  const formattedAcesBalance = formatAmountForDisplay(acesBalance, 18);
  const formattedUsdValue = `$${usdValue.toFixed(2)}`;

  const walletUsernameSeed = user.walletAddress ? user.walletAddress.slice(2, 9).toUpperCase() : '';
  const hasCustomUsername = Boolean(user.username && user.username.trim());
  const usernameValue = hasCustomUsername ? (user.username || '').trim() : walletUsernameSeed;
  const usernameDisplay = usernameValue;

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

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex items-center gap-3">
                  {user.walletAddress ? (
                    <>
                      <div className="text-[#E6E3D3] text-xl md:text-2xl font-semibold truncate">
                        {shortenAddress(user.walletAddress)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#D0B284] hover:bg-[#D0B284]/10 p-2"
                        onClick={handleCopyAddress}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </>
                  ) : (
                    <motion.button
                      className="flex items-center justify-center text-[#D0B264] hover:text-[#D0B264] transition-colors duration-150 px-4 py-2 rounded-md bg-black/80 hover:bg-black/70 border border-[#D0B264]/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono whitespace-nowrap"
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
                {usernameDisplay && (
                  <div className="inline-flex items-center rounded-full border border-[#E6E3D3]/20 bg-black/50 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#E6E3D3]/80 uppercase">
                    {usernameDisplay}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell />
                {onUpdateAccount && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#D0B284] hover:bg-[#D0B284]/10"
                    onClick={() => setIsAccountModalOpen(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-[#D0B284]">
              {user.walletAddress ? (
                <>
                  {user.email && <div className="truncate text-[#E6E3D3]/85">{user.email}</div>}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 text-[#E6E3D3]">
                    <span className="font-mono uppercase tracking-[0.2em]">
                      {getAccountStatus()}
                    </span>
                    <AdminButton />
                  </div>
                </>
              ) : (
                <div className="text-[#E6E3D3]/60">---</div>
              )}
            </div>
          </div>

          <div className="w-full md:max-w-[420px]">
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

      {/* Account Edit Modal */}
      <AccountEditModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentEmail={user.email || ''}
        currentUsername={usernameValue}
        onSave={onUpdateAccount}
      />
    </>
  );
}
