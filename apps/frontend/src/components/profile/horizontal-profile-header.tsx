'use client';

import { useState } from 'react';
import { Edit2, Copy, Check, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { EmailEditModal } from './email-edit-modal';
import { AdminButton } from './admin-button';
import { useAcesTokenBalance } from '@/hooks/use-aces-token-balance';

interface HorizontalProfileHeaderProps {
  user: {
    email: string | undefined;
    walletAddress: string | undefined;
    role?: string;
    sellerStatus?: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  };
  onUpdateEmail?: (email: string) => Promise<void>;
  onConnectWallet?: () => Promise<void>;
}

export function HorizontalProfileHeader({
  user,
  onUpdateEmail,
  onConnectWallet,
}: HorizontalProfileHeaderProps) {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get ACES token balance for portfolio value
  const {
    tokenData,
    hasTokens,
    isLoading: isTokenLoading,
    isWalletConnected,
  } = useAcesTokenBalance();

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

        {/* Four-column info bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {/* Wallet Address */}
          <div className="min-w-0">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-1">
              Wallet Address
            </div>
            <div className="flex items-center gap-2">
              {user.walletAddress ? (
                <>
                  <div className="text-[#E6E3D3] text-base md:text-lg truncate">
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
          </div>

          {/* Email */}
          <div className="min-w-0 lg:border-l lg:border-dashed lg:border-[#E6E3D3]/25 lg:pl-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-1">
              Email
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[#E6E3D3] text-base md:text-lg truncate">
                {!user.walletAddress ? '---' : user.email || 'Not set'}
              </div>
              {onUpdateEmail && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#D0B284] hover:bg-[#D0B284]/10 p-2"
                  onClick={() => setIsEmailModalOpen(true)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Account Status */}
          <div className="min-w-0 lg:border-l lg:border-dashed lg:border-[#E6E3D3]/25 lg:pl-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-1">
              Account Status
            </div>
            <div className="text-[#E6E3D3] text-base md:text-lg mb-3">
              {!user.walletAddress ? '---' : getAccountStatus()}
            </div>
            {/* Admin Button - only shows for admin users */}
            <AdminButton />
          </div>

          {/* Portfolio Value */}
          <div className="min-w-0 lg:border-l lg:border-dashed lg:border-[#E6E3D3]/25 lg:pl-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-1 text-right lg:text-left">
              Portfolio Value
            </div>
            <div className="text-right lg:text-left">
              {!isWalletConnected ? (
                <div className="text-[#E6E3D3] text-lg md:text-xl font-proxima-nova">---</div>
              ) : isTokenLoading ? (
                <div className="text-[#E6E3D3] text-lg md:text-xl font-proxima-nova">
                  Loading...
                </div>
              ) : hasTokens ? (
                <>
                  <div className="text-[#E6E3D3] text-base md:text-lg font-proxima-nova">
                    {parseFloat(tokenData.formattedBalance).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 4,
                    })}{' '}
                    $ACES
                  </div>
                </>
              ) : (
                <div className="text-[#E6E3D3] text-lg md:text-xl font-proxima-nova">0 $ACES</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Edit Modal */}
      <EmailEditModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={user.email || ''}
        onUpdateEmail={onUpdateEmail}
      />
    </>
  );
}
