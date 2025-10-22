// frontend/components/chart/chart-mode-toggles.tsx (USD-ONLY)

'use client';

import { useState, useEffect } from 'react';

interface ChartModeTogglesProps {
  onModeChange: (mode: 'price' | 'mcap') => void;
  initialMode?: 'price' | 'mcap';
  // Support controlled mode (no currency)
  mode?: 'price' | 'mcap';
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ChartModeToggles({
  onModeChange,
  initialMode = 'price',
  // Support controlled mode
  mode: controlledMode,
  className = '',
  disabled = false,
  size = 'md',
  showLabel = false,
}: ChartModeTogglesProps) {
  // Support both controlled and uncontrolled modes (no currency)
  const [internalMode, setInternalMode] = useState<'price' | 'mcap'>(initialMode);

  // Use controlled value if provided, otherwise use internal state
  const chartMode = controlledMode ?? internalMode;

  // Sync internal state with controlled props
  useEffect(() => {
    if (controlledMode !== undefined) {
      setInternalMode(controlledMode);
    }
  }, [controlledMode]);

  const handleModeChange = (mode: 'price' | 'mcap') => {
    if (disabled) return;

    console.log(`[ChartModeToggles] Mode change: ${chartMode} → ${mode}`);

    // Update internal state if not controlled
    if (controlledMode === undefined) {
      setInternalMode(mode);
    }

    // Always call the callback
    onModeChange(mode);
  };

  // Size variants
  const sizeClasses = {
    sm: {
      container: 'p-0.5',
      button: 'px-2 py-0.5 text-xs',
    },
    md: {
      container: 'p-0.5',
      button: 'px-3 py-1 text-xs',
    },
    lg: {
      container: 'p-1',
      button: 'px-4 py-1.5 text-sm',
    },
  };

  const currentSizeClasses = sizeClasses[size];

  return (
    <div
      className={`flex items-center gap-3 ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Optional label */}
      {showLabel && <span className="text-sm text-[#DCDDCC]/60 font-medium">Chart Type:</span>}

      {/* Chart Mode Toggle: Price / MCap (USD-only) */}
      <div
        className={`flex items-center bg-black/40 rounded-lg border border-[#D0B284]/30 ${currentSizeClasses.container}`}
      >
        <button
          onClick={() => handleModeChange('price')}
          disabled={disabled}
          className={`${currentSizeClasses.button} rounded-md font-medium transition-all ${
            chartMode === 'price'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          title="Show price chart (USD)"
        >
          Price
        </button>
        <button
          onClick={() => handleModeChange('mcap')}
          disabled={disabled}
          className={`${currentSizeClasses.button} rounded-md font-medium transition-all ${
            chartMode === 'mcap'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          title="Show market cap chart (USD)"
        >
          MCap
        </button>
      </div>

      {/* Optional USD indicator */}
      <div className="flex items-center">
        <span className="text-xs text-[#DCDDCC]/40 font-medium">USD</span>
      </div>

      {/* Optional loading indicator */}
      {disabled && (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#D0B284]"></div>
        </div>
      )}
    </div>
  );
}

// Export convenience hook (no currency)
export function useChartModeToggle(initialMode: 'price' | 'mcap' = 'price') {
  const [mode, setMode] = useState<'price' | 'mcap'>(initialMode);
  const [isChanging, setIsChanging] = useState(false);

  const handleModeChange = (newMode: 'price' | 'mcap') => {
    if (newMode !== mode) {
      setIsChanging(true);
      setMode(newMode);
      // Reset changing state after a delay to allow chart to reinitialize
      setTimeout(() => setIsChanging(false), 1000);
    }
  };

  return {
    mode,
    isChanging,
    handleModeChange,
  };
}

// Example usage component (USD-only)
export function ChartWithToggles({
  tokenAddress,
  tokenSymbol,
}: {
  tokenAddress: string;
  tokenSymbol?: string;
}) {
  const { mode, isChanging, handleModeChange } = useChartModeToggle();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#DCDDCC]">
          {tokenSymbol} Chart ({mode === 'price' ? 'Price' : 'Market Cap'} - USD)
        </h3>
        <ChartModeToggles mode={mode} onModeChange={handleModeChange} disabled={isChanging} />
      </div>

      {/* Import and use your USD-only TradingViewChart here */}
      {/* <TradingViewChart
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        chartMode={mode}
        onModeChange={handleModeChange}
        showInternalControls={false} // Use external controls only
      /> */}
    </div>
  );
}

// ALTERNATIVE: Inline toggle (more compact)
export function InlineChartModeToggle({
  mode,
  onModeChange,
  disabled = false,
}: {
  mode: 'price' | 'mcap';
  onModeChange: (mode: 'price' | 'mcap') => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center bg-black/40 rounded border border-[#D0B284]/30 ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        onClick={() => onModeChange('price')}
        disabled={disabled}
        className={`px-2 py-1 text-xs font-medium transition-all ${
          mode === 'price'
            ? 'bg-emerald-600 text-white'
            : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
        }`}
      >
        Price
      </button>
      <button
        onClick={() => onModeChange('mcap')}
        disabled={disabled}
        className={`px-2 py-1 text-xs font-medium transition-all ${
          mode === 'mcap'
            ? 'bg-emerald-600 text-white'
            : 'text-[#DCDDCC]/60 hover:text-[#DCDDCC] hover:bg-black/40'
        }`}
      >
        MCap
      </button>
    </div>
  );
}
