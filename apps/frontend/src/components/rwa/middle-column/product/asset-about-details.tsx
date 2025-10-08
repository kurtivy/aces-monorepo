'use client';

import { useState } from 'react';

interface AssetAboutDetailsProps {
  description?: string;
  assetDetails?: Array<{ key: string; value: string }> | null;
}

type DetailItem = { key: string; value: string } | { label: string; value: string };

export default function AssetAboutDetails({ description, assetDetails }: AssetAboutDetailsProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'details'>('about');

  // Parse details from description
  const parseDetailsFromDescription = (desc: string): DetailItem[] => {
    if (!desc) return [];

    const details: DetailItem[] = [];

    // Common patterns to look for
    const patterns = [
      { key: 'Year:', regex: /Year:\s*([^\n\r,]+)/i },
      { key: 'Condition:', regex: /Condition:\s*([^\n\r,]+)/i },
      { key: 'Mileage:', regex: /Mileage:\s*([^\n\r,]+)/i },
      { key: 'Engine:', regex: /Engine:\s*([^\n\r,]+)/i },
      { key: 'Transmission:', regex: /Transmission:\s*([^\n\r,]+)/i },
      { key: 'Color:', regex: /Color:\s*([^\n\r,]+)/i },
      { key: 'Material:', regex: /Material:\s*([^\n\r,]+)/i },
      { key: 'Size:', regex: /Size:\s*([^\n\r,]+)/i },
      { key: 'Weight:', regex: /Weight:\s*([^\n\r,]+)/i },
      { key: 'Dimensions:', regex: /Dimensions:\s*([^\n\r,]+)/i },
      { key: 'Brand:', regex: /Brand:\s*([^\n\r,]+)/i },
      { key: 'Model:', regex: /Model:\s*([^\n\r,]+)/i },
    ];

    patterns.forEach(({ key, regex }) => {
      const match = desc.match(regex);
      if (match && match[1]) {
        details.push({
          label: key,
          value: match[1].trim(),
        });
      }
    });

    return details;
  };

  // Use database assetDetails first, then fall back to parsing from description
  const dbAssetDetails: DetailItem[] = assetDetails || [];
  const parsedDetails = parseDetailsFromDescription(description || '');
  const finalAssetDetails: DetailItem[] =
    dbAssetDetails.length > 0 ? dbAssetDetails : parsedDetails;

  const hasDescription = description && description.trim().length > 0;

  return (
    <div className="w-full flex flex-col rounded-lg border border-[#D0B284]/15 bg-black">
      {/* Tab Navigation */}
      <div className="flex rounded-t-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          aria-selected={activeTab === 'about'}
          className={`flex-1 px-4 py-3 md:py-4 text-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0B284] ${
            activeTab === 'about'
              ? 'bg-[#D0B284]/10 text-white border-b-2 border-[#D0B284]'
              : 'text-[#D0B284]/60 hover:bg-[#D0B284]/5 hover:text-white'
          } min-h-[48px]`}
        >
          <span className="flex items-center justify-center gap-2 text-sm md:text-base font-semibold">
            About This Asset
            {activeTab === 'about' && <span className="h-2 w-2 rounded-full bg-[#D0B284]" />}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('details')}
          aria-selected={activeTab === 'details'}
          className={`flex-1 px-4 py-3 md:py-4 text-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0B284] ${
            activeTab === 'details'
              ? 'bg-[#D0B284]/10 text-white border-b-2 border-[#D0B284]'
              : 'text-[#D0B284]/60 hover:bg-[#D0B284]/5 hover:text-white'
          } min-h-[48px]`}
        >
          <span className="flex items-center justify-center gap-2 text-sm md:text-base font-semibold">
            Asset Details
            {activeTab === 'details' && <span className="h-2 w-2 rounded-full bg-[#D0B284]" />}
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div className="rounded-b-lg">
        <div className="p-4 md:p-6 space-y-4 text-sm md:text-base leading-relaxed">
          {activeTab === 'about' ? (
            hasDescription ? (
              <div className="text-white whitespace-pre-wrap font-proxima-nova">{description}</div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-base md:text-lg">No description found</div>
                <div className="text-gray-500 text-xs md:text-sm mt-2">
                  Description will be available once the asset details are finalized.
                </div>
              </div>
            )
          ) : finalAssetDetails.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {finalAssetDetails.map((detail, index) => (
                <div
                  key={index}
                  className="flex flex-col border-b border-[#D0B284]/10 pb-3 last:border-b-0"
                >
                  <span className="text-[#DCDDCC] text-xs md:text-sm font-medium mb-1 uppercase tracking-wide">
                    {'key' in detail ? detail.key : detail.label}
                  </span>
                  <span className="text-white text-sm md:text-base font-medium">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-base md:text-lg">No details available</div>
              <div className="text-gray-500 text-xs md:text-sm mt-2">
                Asset details will be available once the listing is finalized.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
