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
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Chart Mode Toggle: Price / MCap */}
      <div className="flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-700">
        <button
          onClick={() => handleModeChange('price')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            chartMode === 'price'
              ? 'bg-green-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          Price
        </button>
        <button
          onClick={() => handleModeChange('mcap')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            chartMode === 'mcap'
              ? 'bg-green-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          MCap
        </button>
      </div>

      {/* Currency Toggle: USD / ACES */}
      <div className="flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-700">
        <button
          onClick={() => handleCurrencyChange('usd')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            currency === 'usd'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          USD
        </button>
        <button
          onClick={() => handleCurrencyChange('aces')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            currency === 'aces'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          ACES
        </button>
      </div>

      {/* Info Badge */}
      <div className="text-xs text-gray-400 ml-2">
        {chartMode === 'price' ? '📈 Price Chart' : '💰 Market Cap Chart'}
        {' · '}
        {currency === 'usd' ? '$USD' : 'ACES'}
      </div>
    </div>
  );
}
