'use client';

import { useState } from 'react';

const assetDetails = [
  { label: 'Year:', value: '1991' },
  { label: 'Condition:', value: 'Mint' },
  { label: 'Mileage:', value: '59,000 km (~37,000 miles)' },
  { label: 'Engine:', value: '3.3L Turbocharged Flat-Six' },
  { label: 'Transmission:', value: '5-Speed G50 Manual' },
  { label: 'Color:', value: 'Rubystone Red (G4)' },
];

export default function AssetAboutDetails() {
  const [activeTab, setActiveTab] = useState<'about' | 'details'>('about');

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
              <p className="text-white leading-relaxed mb-4 text-base">
                Presenting an exceptionally rare and highly sought-after{' '}
                <strong className="text-white">1991 Porsche 911 (964) Turbo</strong> finished in{' '}
                <strong className="text-white">Rubystone Red (G4)</strong> — one of only{' '}
                <strong className="text-white">five factory paint-to-sample examples</strong> ever
                produced in this striking color worldwide. This collector-grade 964 Turbo is a
                European-spec (RoW) car that represents the pinnacle of early 1990s Porsche
                engineering, wrapped in a color that is as bold as it is iconic.
              </p>
              <p className="mb-4 text-base leading-relaxed text-white">
                Under the rear decklid lies Porsche&apos;s legendary{' '}
                <strong className="text-white">3.3-liter turbocharged flat-six</strong>, producing{' '}
                <strong className="text-white">320 horsepower and 332 lb-ft of torque</strong>,
                mated to a 5-speed G50 manual transmission and rear-wheel drive. Originally derived
                from the 930 Turbo engine, the powertrain in the 964 Turbo delivers improved
                reliability, smoother power delivery, and modernized electronics, including Bosch
                Motronic management and ABS.
              </p>
              <p className="mb-4 text-base leading-relaxed text-white">
                The exterior showcases the classic widebody Turbo silhouette with its muscular
                arches, integrated fog lights, and the instantly recognizable &quot;whale tail&quot;
                rear spoiler. Factory <strong className="text-white">17&quot; Cup wheels</strong>{' '}
                complement the aggressive stance, while the{' '}
                <strong className="text-white">Rubystone Red paintwork</strong> elevates this
                example into a league of its own—instantly recognizable and beloved by enthusiasts
                for its daring originality.
              </p>
              <p className="mb-4 text-base leading-relaxed text-white">
                The interior features the classic 964 Turbo cabin with sport seats, a
                leather-wrapped steering wheel, and the distinctive Turbo gauge cluster. Every
                detail has been meticulously maintained, from the original radio to the pristine
                door panels and carpeting.
              </p>
            </div>
          ) : (
            /* Asset Details Content */
            <div className="grid grid-cols-1 gap-4">
              {assetDetails.map((detail, index) => (
                <div
                  key={index}
                  className="flex flex-col py-2 border-b border-[#D0B284]/10 last:border-b-0"
                >
                  <span className="text-[#DCDDCC] text-sm font-medium mb-1">{detail.label}</span>
                  <span className="text-white text-base font-medium">{detail.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
