'use client';

import { useState } from 'react';
import { Edit2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailEditModal } from './email-edit-modal';

interface HorizontalProfileHeaderProps {
  user: {
    email: string | undefined;
    walletAddress: string | undefined;
    role?: string;
  };
  onUpdateEmail?: (email: string) => Promise<void>;
}

export function HorizontalProfileHeader({ user, onUpdateEmail }: HorizontalProfileHeaderProps) {
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
              <div className="text-[#E6E3D3] text-xl md:text-2xl truncate">
                {user.walletAddress ? shortenAddress(user.walletAddress) : 'Not connected'}
              </div>
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
          </div>

          {/* Email */}
          <div className="min-w-0 lg:border-l lg:border-dashed lg:border-[#E6E3D3]/25 lg:pl-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-1">
              Email
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[#E6E3D3] text-xl md:text-2xl truncate">
                {user.email || 'Not set'}
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
            <div className="text-[#E6E3D3] text-xl md:text-2xl">VERIFIED</div>
          </div>

          {/* Portfolio Value */}
          <div className="min-w-0 lg:border-l lg:border-dashed lg:border-[#E6E3D3]/25 lg:pl-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium mb-1 text-right lg:text-left">
              Portfolio Value
            </div>
            <div className="text-right lg:text-left">
              <div className="text-[#E6E3D3] text-xl md:text-2xl">5.423 ETH</div>
              <div className="text-[#E6E3D3] text-lg md:text-xl opacity-90">23886.93 USD</div>
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
