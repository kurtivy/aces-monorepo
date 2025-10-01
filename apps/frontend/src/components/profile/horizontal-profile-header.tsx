'use client';

import { useEffect, useState } from 'react';
import { Edit2, Copy, Check, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AccountEditModal } from './account-edit-modal';
import { AdminButton } from './admin-button';
import { NotificationBell } from '@/components/ui/custom/notification-bell';
import { fetchPortfolioSummary, formatCurrency, type PortfolioSummary } from '@/lib/api/portfolio';

type PortfolioMetricsWithUsd = PortfolioSummary['metrics'] & {
  totalValueUsd?: string | number | null;
  totalValueUSD?: string | number | null;
};

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
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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

  const metrics = portfolioSummary?.metrics;
  const usdValueRaw = metrics
    ? ((metrics as PortfolioMetricsWithUsd).totalValueUsd ??
      (metrics as PortfolioMetricsWithUsd).totalValueUSD ??
      null)
    : null;

  const formattedPortfolioValue = metrics
    ? `${formatCurrency(metrics.totalValue, 2)} ACES`
    : '0.00 ACES';
  const formattedUsdValue = usdValueRaw != null ? `$${formatCurrency(usdValueRaw, 2)}` : '$0.00';
  const formattedTokenCount = metrics ? metrics.tokenCount.toLocaleString('en-US') : '0';
  const walletUsernameSeed = user.walletAddress ? user.walletAddress.slice(2, 9).toUpperCase() : '';
  const hasCustomUsername = Boolean(user.username && user.username.trim());
  const usernameValue = hasCustomUsername ? (user.username || '').trim() : walletUsernameSeed;
  const usernameDisplay = usernameValue;

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      if (!user.walletAddress) {
        if (isMounted) {
          setPortfolioSummary(null);
          setSummaryError(null);
          setIsSummaryLoading(false);
        }
        return;
      }

      if (!isMounted) return;

      setIsSummaryLoading(true);
      setSummaryError(null);

      try {
        const result = await fetchPortfolioSummary(user.walletAddress);
        if (!isMounted) return;

        if (result.success && result.data) {
          setPortfolioSummary(result.data);
        } else {
          const errorMessage =
            typeof result.error === 'string'
              ? result.error
              : result.error?.message || 'Unable to load portfolio summary';
          setSummaryError(errorMessage);
          setPortfolioSummary(null);
        }
      } catch (error) {
        if (!isMounted) return;
        setSummaryError('Unable to load portfolio summary');
        setPortfolioSummary(null);
      } finally {
        if (isMounted) {
          setIsSummaryLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [user.walletAddress]);

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

          <div className="w-full md:max-w-[520px]">
            <div className="bg-black/30 border border-[#D0B284]/20 rounded-xl px-6 py-5 backdrop-blur-sm">
              {isSummaryLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-2 bg-[#D0B284]/10 rounded" />
                      <div className="h-6 bg-[#D0B284]/20 rounded" />
                    </div>
                  ))}
                </div>
              ) : !user.walletAddress ? (
                <div className="text-sm text-[#DCDDCC]/70 text-center">
                  Connect your wallet to view portfolio metrics.
                </div>
              ) : summaryError ? (
                <div className="text-sm text-red-400 text-center">{summaryError}</div>
              ) : portfolioSummary ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-[#D7BF75] text-[11px] uppercase tracking-[0.3em]">
                      Total Value
                    </div>
                    <div className="text-2xl font-semibold text-[#E6E3D3]">
                      {formattedPortfolioValue}
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
                      Tokens
                    </div>
                    <div className="text-2xl font-semibold text-[#E6E3D3]">
                      {formattedTokenCount}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#DCDDCC]/70 text-center">
                  Portfolio metrics will appear once available.
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
