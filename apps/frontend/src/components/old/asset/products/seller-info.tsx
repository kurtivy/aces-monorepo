'use client';
import { useState } from 'react';

interface SellerDetail {
  label: string;
  value: string;
  isButton?: boolean;
  onClick?: () => void;
}

interface SellerInformationProps {
  name: string;
  initials: string;
  listingCount: number;
  aboutText: string;
  details: SellerDetail[];
  onQuestionSubmit: (message: string) => void;
  className?: string;
}

export default function SellerInformation({
  name,
  initials,
  aboutText,
  details,
  onQuestionSubmit,
  className = '',
}: SellerInformationProps) {
  const [questionText, setQuestionText] = useState('');
  const [showFullAbout, setShowFullAbout] = useState(false);

  const handleQuestionSubmit = () => {
    if (questionText.trim()) {
      onQuestionSubmit(questionText);
      setQuestionText('');
    }
  };

  return (
    <div
      className={`bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20 shadow-lg ${className}`}
    >
      <h3 className="text-2xl font-bold text-[#DCDDCC] mb-6">Seller Information</h3>

      {/* Seller Profile */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-[#D0B284] rounded-xl flex items-center justify-center shadow-md">
          <span className="text-black font-bold text-xl">{initials}</span>
        </div>
        <div>
          <h4 className="font-bold text-white text-lg">{name}</h4>
        </div>
      </div>

      {/* About Section */}
      <div className="mb-6">
        <h5 className="font-semibold mb-3 text-[#DCDDCC]">About</h5>
        <div className={`text-white leading-relaxed ${!showFullAbout ? 'line-clamp-3' : ''}`}>
          {aboutText}
        </div>
        <button
          onClick={() => setShowFullAbout(!showFullAbout)}
          className="text-[#D0B284] hover:text-[#D7BF75] font-medium mt-2 underline transition-colors"
        >
          {showFullAbout ? 'view less' : 'view more'}
        </button>
      </div>

      {/* Seller Details */}
      <div className="space-y-3 mb-8">
        {details.map((detail, index) => (
          <div key={index} className="grid grid-cols-[140px_1fr] gap-4">
            <span className="text-[#DCDDCC] font-semibold text-base">{detail.label}</span>
            {detail.isButton ? (
              <button
                onClick={detail.onClick}
                className="text-[#D0B284] hover:text-[#D7BF75] text-base underline text-left transition-colors"
              >
                {detail.value}
              </button>
            ) : (
              <span className="font-medium text-[#FFFFFF] text-base">{detail.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Contact/Ask Question Section */}
      <div className="border-t border-[#D0B284]/20 pt-6">
        <h5 className="font-semibold font-xl mb-4 text-[#DCDDCC]">Contact Seller</h5>

        <div className="mb-4">
          <label className="block text-sm font-medium italic text-[#DCDDCC] mb-2">
            Ask a Question
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask the seller for more information about this asset..."
            className="w-full min-h-[100px] bg-black/40 border border-[#D0B284]/30 rounded-xl p-4 text-[#FFFFFF] placeholder:text-[#928357] focus:border-[#D0B284] focus:outline-none focus:ring-2 focus:ring-[#D0B284]/20 transition-all"
          />
        </div>

        <button
          onClick={handleQuestionSubmit}
          disabled={!questionText.trim()}
          className="w-full bg-[#D0B284] hover:bg-[#D7BF75] disabled:bg-[#D0B284]/50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all duration-200 shadow-md"
        >
          Send Question
        </button>
      </div>
    </div>
  );
}
