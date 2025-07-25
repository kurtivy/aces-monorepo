'use client';

import type { ModalProps } from '../types/section.types';

// Share Modal Component
export function ShareModal({ onClose }: ModalProps) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const shareOptions = [
    { name: 'Copy Link', action: () => navigator.clipboard.writeText(shareUrl) },
    {
      name: 'Twitter',
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=Check out King Solomon's Baby - Real World Asset!`,
        ),
    },
    {
      name: 'Facebook',
      action: () =>
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`),
    },
    {
      name: 'LinkedIn',
      action: () =>
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        ),
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-[#D0B284] text-xl font-bold"
            style={{ fontFamily: "'Spray Letters', cursive" }}
          >
            SHARE WITH YOUR RICH BUDDY
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-[#D0B284] text-xl font-bold"
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
            <h4 className="text-[#D0B284] font-bold mb-2">Digital Asset Delivery</h4>
            <p className="text-sm leading-relaxed">
              Upon successful purchase, your RWA tokens will be instantly delivered to your
              connected wallet. The tokens represent fractional ownership of King Solomon&apos;s
              Baby sculpture.
            </p>
          </div>

          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Physical Rights</h4>
            <p className="text-sm leading-relaxed">
              Token holders will receive voting rights on the sculpture&apos;s future, including
              decisions about exhibitions, sales, and potential physical division based on the
              original MSCHF concept.
            </p>
          </div>

          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Timeline</h4>
            <ul className="text-sm space-y-1">
              <li>• Token delivery: Immediate upon purchase</li>
              <li>• Voting period: 30 days after sale completion</li>
              <li>• Physical delivery: If voted, 60-90 days processing</li>
            </ul>
          </div>

          <div className="bg-[#D0B284]/10 border border-[#D0B284]/20 rounded-lg p-4">
            <p className="text-xs text-[#D0B284]">
              <strong>Note:</strong> This is a conceptual RWA implementation. Actual delivery terms
              would be subject to legal agreements and regulatory compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
