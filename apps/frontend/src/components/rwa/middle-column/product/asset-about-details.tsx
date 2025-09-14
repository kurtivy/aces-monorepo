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
    <div className="min-h-screen w-full flex flex-col ">
      {/* Tab Navigation */}
      <div className="flex bg-[#231F20] rounded-t-lg border border-[#D0B284]/20 border-b-0">
        <button
          onClick={() => setActiveTab('about')}
          className={`flex-1 p-4 text-left transition-all duration-300 rounded-tl-lg ${
            activeTab === 'about'
              ? 'bg-[#D0B284]/10 text-white border-b-2 border-[#D0B284]'
              : 'text-[#D0B284]/60 hover:bg-[#D0B284]/5 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center">
            <h2 className="text-xl font-bold">About This Asset</h2>
            {activeTab === 'about' && (
              <div className="w-2 h-2 bg-[#D0B284] rounded-full ml-2"></div>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 p-4 text-left transition-all duration-300 rounded-tr-lg ${
            activeTab === 'details'
              ? 'bg-[#D0B284]/10 text-white border-b-2 border-[#D0B284]'
              : 'text-[#D0B284]/60 hover:bg-[#D0B284]/5 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center">
            <h2 className="text-xl font-bold">Asset Details</h2>
            {activeTab === 'details' && (
              <div className="w-2 h-2 bg-[#D0B284] rounded-full ml-2"></div>
            )}
          </div>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-[#231F20] rounded-b-lg border border-[#D0B284]/20 border-t-0 overflow-hidden">
        <div className="p-4 h-full overflow-y-auto">
          {activeTab === 'about' ? (
            /* About This Asset Content */
            <div className="space-y-4">
              {hasDescription ? (
                <div className="text-white leading-relaxed text-base whitespace-pre-wrap">
                  {description}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-lg">No description found</div>
                  <div className="text-gray-500 text-sm mt-2">
                    Description will be available once the asset details are finalized.
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Asset Details Content */
            <div className="grid grid-cols-1 gap-4">
              {finalAssetDetails.length > 0 ? (
                finalAssetDetails.map((detail, index) => (
                  <div
                    key={index}
                    className="flex flex-col py-2 border-b border-[#D0B284]/10 last:border-b-0"
                  >
                    <span className="text-[#DCDDCC] text-sm font-medium mb-1">
                      {'key' in detail ? detail.key : detail.label}:
                    </span>
                    <span className="text-white text-base font-medium">{detail.value}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-lg">No details available</div>
                  <div className="text-gray-500 text-sm mt-2">
                    Asset details will be available once the listing is finalized.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
