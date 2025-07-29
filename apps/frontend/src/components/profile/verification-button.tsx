'use client';

import { useState } from 'react';
import { Shield, Info, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VerificationForm } from './verification-form';
import { useAuth } from '@/lib/auth/auth-context';

interface VerificationButtonProps {
  onSellerDashboardClick?: () => void;
}

export function VerificationButton({ onSellerDashboardClick }: VerificationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, isVerifiedSeller } = useAuth();

  const getButtonState = () => {
    if (isVerifiedSeller) {
      return {
        text: 'Seller Dashboard',
        icon: Shield,
        variant: 'default' as const,
        className: 'bg-[#184D37] hover:bg-[#184D37]/80 text-white',
        onClick: onSellerDashboardClick,
      };
    }

    if (user?.sellerStatus === 'PENDING') {
      return {
        text: 'Verification Pending',
        icon: Clock,
        variant: 'outline' as const,
        className: 'border-[#D7BF75] text-[#D7BF75] hover:bg-[#D7BF75]/10',
        onClick: () => setIsModalOpen(true),
      };
    }

    if (user?.sellerStatus === 'REJECTED') {
      return {
        text: 'Reapply for Verification',
        icon: AlertCircle,
        variant: 'outline' as const,
        className: 'border-red-400 text-red-400 hover:bg-red-400/10',
        onClick: () => setIsModalOpen(true),
      };
    }

    return {
      text: 'Get Verified',
      icon: Shield,
      variant: 'outline' as const,
      className: 'border-[#D0B284] text-[#D0B284] hover:bg-[#D0B284]/10',
      onClick: () => setIsModalOpen(true),
    };
  };

  const buttonState = getButtonState();
  const IconComponent = buttonState.icon;

  return (
    <>
      <div className="relative">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={buttonState.variant}
                className={`${buttonState.className} relative pr-12`}
                onClick={buttonState.onClick}
              >
                <IconComponent className="w-4 h-4 mr-2" />
                {buttonState.text}
                {!isVerifiedSeller && (
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#D0B284] rounded-full flex items-center justify-center">
                    <Info className="w-2.5 h-2.5 text-black" />
                  </div>
                )}
              </Button>
            </TooltipTrigger>
            {!isVerifiedSeller && (
              <TooltipContent className="bg-[#231F20] border border-[#D0B284]/20 text-white max-w-xs">
                <div className="space-y-2">
                  <p className="font-medium text-[#D0B284]">Verified Account Benefits:</p>
                  <ul className="text-sm space-y-1">
                    <li>• Become a seller and list RWA tokens</li>
                    <li>• Bid on RWAs for purchase</li>
                    <li>• Access advanced trading features</li>
                    <li>• Higher trust rating with buyers</li>
                  </ul>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTitle className="sr-only">Verification</DialogTitle>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-black border border-[#D0B284]/20">
          <VerificationForm
            onSuccess={() => setIsModalOpen(false)}
            onCancel={() => setIsModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
