'use client';

import { useState } from 'react';
import { UserProfile } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Crown, Check, Clock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VerificationForm } from '@/components/seller/verification-form';

interface SellerVerificationCardProps {
  user: UserProfile | null;
}

export function SellerVerificationCard({ user }: SellerVerificationCardProps) {
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  if (!user) return null;

  const renderContent = () => {
    switch (user.sellerStatus) {
      case 'NOT_APPLIED':
        return (
          <div className="space-y-4">
            <p className="text-[#DCDDCC]">
              Apply to become a verified seller and list your assets on our platform.
            </p>
            <Button
              variant="ghost"
              className="text-[#D0B284] hover:bg-[#D0B284]/20"
              onClick={() => setShowVerificationModal(true)}
            >
              <Crown className="w-4 h-4 mr-2" />
              Apply Now
            </Button>
          </div>
        );

      case 'PENDING':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <Clock className="w-5 h-5" />
              <span>Application Under Review</span>
            </div>
            <p className="text-[#DCDDCC]">
              Your application is being reviewed by our team. We&apos;ll notify you once a decision
              has been made.
            </p>
          </div>
        );

      case 'APPROVED':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="w-5 h-5" />
              <span>Verified Seller</span>
            </div>
            <p className="text-[#DCDDCC]">
              You have full access to the seller dashboard and can list assets.
            </p>
          </div>
        );

      case 'REJECTED':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <X className="w-5 h-5" />
              <span>Application Rejected</span>
            </div>
            <p className="text-[#DCDDCC]">
              {user.rejectionReason || 'Your application did not meet our current requirements.'}
            </p>
            <Button
              variant="ghost"
              className="text-[#D0B284] hover:bg-[#D0B284]/20"
              onClick={() => setShowVerificationModal(true)}
            >
              <Crown className="w-4 h-4 mr-2" />
              Apply Again
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-[#D0B284] text-2xl font-bold">Seller Verification</h2>
          <p className="text-[#DCDDCC] text-sm">Manage your seller status</p>
        </div>

        {/* Content */}
        {renderContent()}
      </div>

      {/* Verification Modal */}
      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="sm:max-w-[800px] bg-black border-[#D0B284]">
          <DialogHeader>
            <DialogTitle className="text-[#D0B284] text-2xl">Seller Verification</DialogTitle>
          </DialogHeader>
          <VerificationForm
            onSuccess={() => setShowVerificationModal(false)}
            onCancel={() => setShowVerificationModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
