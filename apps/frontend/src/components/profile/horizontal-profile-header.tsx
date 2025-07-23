'use client';

import { useState } from 'react';
import { Edit2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailEditModal } from './email-edit-modal';
import { VerificationButton } from './verification-button';
import { AdminDashboardButton } from './admin-dashboard-button';

interface HorizontalProfileHeaderProps {
  user: {
    displayName: string | undefined;
    email: string | undefined;
    walletAddress: string | undefined;
    role?: string;
    sellerStatus?: string;
  };
  onUpdateEmail?: (email: string) => Promise<void>;
  onSellerDashboardClick?: () => void;
  onAdminDashboardClick?: () => void;
}

export function HorizontalProfileHeader({
  user,
  onUpdateEmail,
  onSellerDashboardClick,
  onAdminDashboardClick,
}: HorizontalProfileHeaderProps) {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
      <div className="rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            {/* Left side - Main profile info */}
            <div className="flex items-center space-x-8">
              {/* Wallet Address - Primary identifier */}
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white font-libre-caslon">
                  {user.walletAddress ? shortenAddress(user.walletAddress) : 'Not connected'}
                </h1>
                {user.walletAddress && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#D0B284] hover:bg-[#D0B284]/10 p-2"
                    onClick={handleCopyAddress}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>

              {/* Display Name */}
              {user.displayName && (
                <div className="border-l border-[#D0B284]/20 pl-6">
                  <label className="text-[#DCDDCC] text-xs font-jetbrains uppercase tracking-wide">
                    Display Name
                  </label>
                  <p className="text-white font-medium mt-1">{user.displayName}</p>
                </div>
              )}

              {/* Verification Status */}
              {user.walletAddress && (
                <div className="border-l border-[#D0B284]/20 pl-6">
                  <label className="text-[#DCDDCC] text-xs font-jetbrains uppercase tracking-wide">
                    Status
                  </label>
                  <div className="flex items-center space-x-2 mt-1">
                    {user.role === 'ADMIN' && (
                      <span className="text-purple-400 text-sm">👑 Admin</span>
                    )}
                    {user.role === 'SELLER' && user.sellerStatus === 'APPROVED' && (
                      <span className="text-[#184D37] text-sm">✅ Verified Seller</span>
                    )}
                    {user.role === 'SELLER' && user.sellerStatus === 'PENDING' && (
                      <span className="text-[#D7BF75] text-sm">⏳ Pending Verification</span>
                    )}
                    {user.role === 'TRADER' && (
                      <span className="text-[#D0B284] text-sm">💎 Trader</span>
                    )}
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="border-l border-[#D0B284]/20 pl-6">
                <div className="flex items-center space-x-2">
                  <label className="text-[#DCDDCC] text-xs font-jetbrains uppercase tracking-wide">
                    Email
                  </label>
                  {onUpdateEmail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#D0B284] hover:bg-[#D0B284]/10 p-1"
                      onClick={() => setIsEmailModalOpen(true)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <p className="text-white font-medium mt-1">{user.email || 'Not set'}</p>
              </div>
            </div>

            {/* Right side - Portfolio value and verification button */}
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <label className="text-[#DCDDCC] text-xs font-jetbrains uppercase tracking-wide">
                  Portfolio Value
                </label>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-white text-lg font-medium">74.31 ETH</span>
                  <span className="text-[#DCDDCC]">$243,541</span>
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <VerificationButton onSellerDashboardClick={onSellerDashboardClick} />
                <AdminDashboardButton onAdminDashboardClick={onAdminDashboardClick} />
              </div>
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
