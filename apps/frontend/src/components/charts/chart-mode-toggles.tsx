// frontend/components/chart/chart-mode-toggles.tsx (NEW)

'use client';

import { useState } from 'react';

interface ChartModeTogglesProps {
  onModeChange: (mode: 'price' | 'mcap') => void;
  onCurrencyChange: (currency: 'usd' | 'aces') => void;
  initialMode?: 'price' | 'mcap';
  initialCurrency?: 'usd' | 'aces';
  className?: string;
}

export function ChartModeToggles({
  onModeChange,
  onCurrencyChange,
  initialMode = 'price',
  initialCurrency = 'usd',
  className = '',
}: ChartModeTogglesProps) {
  const [chartMode, setChartMode] = useState<'price' | 'mcap'>(initialMode);
  const [currency, setCurrency] = useState<'usd' | 'aces'>(initialCurrency);

  const handleModeChange = (mode: 'price' | 'mcap') => {
    setChartMode(mode);
    onModeChange(mode);
  };

  const handleCurrencyChange = (curr: 'usd' | 'aces') => {
    setCurrency(curr);
    onCurrencyChange(curr);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Chart Mode Toggle: Price / MCap */}
      <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-[#D0B284]/30">
        <button
          onClick={() => handleModeChange('price')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            chartMode === 'price'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
          }`}
        >
          Price
        </button>
        <button
          onClick={() => handleModeChange('mcap')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            chartMode === 'mcap'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
          }`}
        >
          MCap
        </button>
      </div>

      {/* Currency Toggle: USD / ACES */}
      <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-[#D0B284]/30">
        <button
          onClick={() => handleCurrencyChange('usd')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            currency === 'usd'
              ? 'bg-[#D0B284] text-black shadow-lg'
              : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
          }`}
        >
          USD
        </button>
        <button
          onClick={() => handleCurrencyChange('aces')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            currency === 'aces'
              ? 'bg-[#D0B284] text-black shadow-lg'
              : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
          }`}
        >
          ACES
        </button>
      </div>
    </div>
  );
}
