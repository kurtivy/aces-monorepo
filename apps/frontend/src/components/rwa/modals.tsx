'use client';

import type { ModalProps } from '../../types/rwa/section.types';

interface ShareModalProps extends ModalProps {
  title: string;
  symbol: string;
}

const SHARE_DOMAIN = 'https://aces.fun';

// Share Modal Component
export function ShareModal({ onClose, title, symbol }: ShareModalProps) {
  const sharePath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : `/rwa/${symbol}`;
  const shareUrl = `${SHARE_DOMAIN}${sharePath}`;
  const shareMessage = `Check out ${title} on ACES!`;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedMessage = encodeURIComponent(shareMessage);

  const shareOptions = [
    {
      name: 'Copy Link',
      action: () => navigator?.clipboard?.writeText(shareUrl),
    },
    {
      name: 'Twitter',
      action: () =>
        window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedMessage}`),
    },
    {
      name: 'Facebook',
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`),
    },
    {
      name: 'LinkedIn',
      action: () =>
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`),
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#151c16] border border-[#D0B284]/20 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-[#D0B284] text-xl font-bold font-spray-letters"
            style={{ fontFamily: "'Spray Letters', cursive" }}
          >
            TRADE WITH FRIENDS
          </h3>
          <button onClick={onClose} className="text-[#D0B284] hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {shareOptions.map((option) => (
            <button
              key={option.name}
              onClick={option.action}
              className="w-full bg-[#D0B284]/10 hover:bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/20 rounded-lg p-3 transition-all duration-200 text-left"
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Delivery Modal Component
export function DeliveryModal({ onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-[#151c16]/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#151c16] border border-[#D0B284]/20 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-[#D0B284] text-xl font-bold font-spray-letters"
            style={{ fontFamily: "'Spray Letters', cursive" }}
          >
            DELIVERY INFORMATION
          </h3>
          <button onClick={onClose} className="text-[#D0B284] hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-[#DCDDCC]">
          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Payment & Delivery Process</h4>
            <p className="text-sm leading-relaxed">
              Funds are held at the payment processor until the buyer confirms receipt of the asset.
            </p>
          </div>

          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Seller Responsibilities</h4>
            <p className="text-sm leading-relaxed">
              The seller retains primary responsibility for arranging delivery and completing any
              required paperwork, but can also access additional services from the Aces.fun team
              and/or AI Agent for a smoother transaction.
            </p>
          </div>

          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Transaction Verification Process</h4>
            <p className="text-sm leading-relaxed">
              Both seller and buyer must complete the transaction verification process: seller
              confirms shipment details with tracking, buyer inspects the asset upon receipt, both
              parties verify the asset&apos;s condition matches the listing, buyer signs off on
              successful delivery, and seller confirms the completion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
