'use client';
import { useState } from 'react';

interface AssetDetail {
  label: string;
  value: string;
}

interface AssetInformationProps {
  aboutContent: React.ReactNode;
  details: AssetDetail[];
  className?: string;
}

export default function AssetInformation({
  aboutContent,
  details,
  className = '',
}: AssetInformationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(true);

  return (
    <div
      className={`bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20 shadow-lg ${className}`}
    >
      {/* About This Asset */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-[#DCDDCC] mb-6">About This Asset</h3>

        <div>
          <div
            ref={(el) => {
              if (el) {
                // Check if content needs truncation
                const lineHeight = parseInt(getComputedStyle(el).lineHeight);
                const maxHeight = lineHeight * 6; // 6 lines
                if (el.scrollHeight <= maxHeight * 1.2) {
                  setShouldTruncate(false);
                }
              }
            }}
            className={`${!isExpanded && shouldTruncate ? 'line-clamp-6' : ''} overflow-hidden transition-all duration-300`}
          >
            <div className="prose prose-invert max-w-none text-white">{aboutContent}</div>
          </div>

          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#D0B284] hover:text-[#D7BF75] font-medium mt-4 transition-colors duration-200 underline"
            >
              {isExpanded ? 'view less' : 'view more'}
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#D0B284]/20 mb-8"></div>

      {/* Asset Details */}
      <div>
        <h3 className="text-2xl font-bold text-[#DCDDCC] mb-6">Asset Details</h3>

        <div className="space-y-4">
          {details.map((detail, index) => (
            <div key={index} className="grid grid-cols-[140px_1fr] gap-4 items-center py-2">
              <span className="text-[#DCDDCC] font-semibold text-base font-libre-caslon">
                {detail.label}
              </span>
              <span className="font-medium text-[#FFFFFF] text-base">{detail.value}</span>
            </div>
          ))}

          {/* Decorative bottom border */}
        </div>
      </div>
    </div>
  );
}
