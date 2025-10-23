'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { UnifiedDatafeed } from '@/lib/tradingview/unified-datafeed';

const toolbarStylesId = 'aces-tradingview-toolbar-styles';

const ensureTradingViewToolbarStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(toolbarStylesId)) return;

  const style = document.createElement('style');
  style.id = toolbarStylesId;
  style.textContent = `
    .aces-tv-mode-button {
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    .aces-tv-mode-toggle {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      background: rgba(22, 30, 46, 0.75);
      border-radius: 9999px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 12px rgba(0, 0, 0, 0.35);
      transition: background 0.2s ease, box-shadow 0.2s ease;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .aces-tv-mode-toggle:hover {
      background: rgba(35, 47, 70, 0.85);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 16px rgba(0, 0, 0, 0.4);
    }

    .aces-tv-mode-option {
      appearance: none;
      border: none;
      background: transparent;
      color: #a0aec0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 4px 12px;
      border-radius: 9999px;
      cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .aces-tv-mode-option:focus-visible {
      outline: 1px solid #d0b284;
      outline-offset: 2px;
    }

    .aces-tv-mode-option::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.06);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .aces-tv-mode-option:hover::before {
      opacity: 1;
    }

    .aces-tv-mode-option:active {
      transform: scale(0.97);
    }

    .aces-tv-mode-option[data-interacting='true'] {
      transform: scale(0.96);
      background: rgba(16, 185, 129, 0.2);
    }

    .aces-tv-mode-option[data-active='true'] {
      color: #0f172a;
      background: linear-gradient(135deg, #34d399, #10b981);
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.35);
    }

    .aces-tv-mode-option[data-active='true']::after {
      content: '';
      position: absolute;
      inset: -20%;
      border-radius: 9999px;
      background: radial-gradient(circle at center, rgba(52, 211, 153, 0.32), transparent 60%);
      opacity: 1;
      pointer-events: none;
    }

    .aces-tv-mode-option[data-active='false']::after {
      opacity: 0;
    }

    .aces-tv-mode-option[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(style);
};

// Helper function to format prices with zero-count subscript notation
// Example: 0.000001 → 0.0₅1
const formatPriceWithZeroCount = (price: number): string => {
  if (price === 0) return '$0.00';
  if (price >= 0.01) return `$${price.toFixed(2)}`;

  const str = price.toFixed(18);
  const match = str.match(/^0\.(0+)([1-9]\d{0,2})/);

  if (match) {
    const zeros = match[1].length;
    const digits = match[2];

    // Subscript Unicode characters
    const subscriptMap: { [key: string]: string } = {
      '0': '₀',
      '1': '₁',
      '2': '₂',
      '3': '₃',
      '4': '₄',
      '5': '₅',
      '6': '₆',
      '7': '₇',
      '8': '₈',
      '9': '₉',
    };

    if (zeros >= 4) {
      const subscriptZeros = zeros
        .toString()
        .split('')
        .map((d) => subscriptMap[d] || d)
        .join('');
      return `$0.0${subscriptZeros}${digits}`;
    }
  }

  return `$${price.toFixed(8)}`;
};

interface TradingViewChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  imageSrc?: string;
  heightClass?: string;
  heightPx?: number;
  minHeightPx?: number;
  hideNativeHeader?: boolean;
  dexMeta?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: string | null;
    priceSource: 'BONDING_CURVE' | 'DEX';
    lastUpdated: string | null;
    bondingCutoff: string | null;
  } | null;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const TradingViewChart: React.FC<TradingViewChartProps> = React.memo(
  ({
    tokenAddress,
    tokenSymbol = 'TOKEN',
    heightClass = 'h-[600px] min-h-[400px]',
    heightPx,
    minHeightPx,
    hideNativeHeader = false,
  }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<any>(null);
    const datafeedRef = useRef<any>(null);
    const modeButtonRef = useRef<HTMLElement | null>(null);
    const priceOptionRef = useRef<HTMLButtonElement | null>(null);
    const mcapOptionRef = useRef<HTMLButtonElement | null>(null);
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isReinitializing, setIsReinitializing] = useState(false);

    // Chart mode (USD-only)
    const [chartMode, setChartMode] = useState<'price' | 'mcap'>('price');
    const chartModeRef = useRef<'price' | 'mcap'>(chartMode);
    const currency = 'usd' as const;

    // Stabilize tokenSymbol to prevent unnecessary re-renders
    const stableTokenSymbol = useRef(tokenSymbol);
    useEffect(() => {
      // Only update if tokenAddress changes (new token), not just symbol changes
      stableTokenSymbol.current = tokenSymbol;
    }, [tokenAddress]); // Only depends on tokenAddress, not tokenSymbol

    // Cleanup datafeed function
    const cleanupDatafeed = useCallback(() => {
      if (datafeedRef.current) {
        console.log('[TradingView] 🧹 Cleaning up old datafeed');

        // UnifiedDatafeed has unsubscribeBars method
        if (typeof datafeedRef.current.unsubscribeBars === 'function') {
          try {
            // Call unsubscribe for any active subscriptions
            datafeedRef.current.unsubscribeBars('all');
          } catch (error) {
            console.warn('[TradingView] Error during datafeed cleanup:', error);
          }
        }

        // Clear the reference
        datafeedRef.current = null;
      }
    }, []);

    // Load TradingView library
    useEffect(() => {
      if (window.TradingView) {
        setIsLibraryLoaded(true);
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = '/charting_library/charting_library.standalone.js';
      script.async = true;
      script.onload = () => {
        setIsLibraryLoaded(true);
        setIsLoading(false);
      };
      script.onerror = () => {
        setError('Failed to load TradingView library');
        setIsLoading(false);
      };

      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }, []);

    // Initialize chart
    useEffect(() => {
      if (!isLibraryLoaded || !chartContainerRef.current || !tokenAddress) {
        return;
      }

      if (!tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        setError('Invalid token address format');
        return;
      }

      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (err) {
          console.warn('[TradingView] Failed to remove existing widget');
        }
        widgetRef.current = null;
      }

      // Cleanup old datafeed
      cleanupDatafeed();

      setIsReinitializing(true);
      setError(null);

      try {
        // Create unified datafeed (handles both price and market cap)
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002/ws/chart';

        const datafeed = new UnifiedDatafeed({
          apiBaseUrl,
          wsUrl, // Enabled for real-time updates
          debug: process.env.NODE_ENV === 'development',
        });

        datafeedRef.current = datafeed;

        // Expose datafeed to window for debugging
        if (typeof window !== 'undefined') {
          (window as any).__tradingViewDatafeed = datafeed;
        }

        // Use token address + mode as the symbol for the datafeed
        // Format: "0x123...abc" for price mode, "0x123...abc_MCAP" for market cap mode
        const chartSymbol = chartMode === 'price' ? tokenAddress : `${tokenAddress}_MCAP`;

        widgetRef.current = new window.TradingView.widget({
          container: chartContainerRef.current,
          library_path: '/charting_library/',
          locale: 'en',
          disabled_features: [
            'use_localstorage_for_settings',
            'create_volume_indicator_by_default_once',
            'header_saveload',
            'study_templates', // Disable to prevent CORS errors with TradingView's save/load service
          ],
          enabled_features: [
            'side_toolbar_in_fullscreen_mode',
            'header_widget',
            'header_widget_dom_node',
            'timeframes_toolbar',
            'volume_force_overlay',
          ],
          // Removed charts_storage_url and related config to prevent CORS errors
          // Users can still draw on charts, but templates won't be saved
          fullscreen: false,
          autosize: true,
          symbol: chartSymbol,
          interval: chartMode === 'mcap' ? '5' : '15', // Use 5min for market cap, 15min for price
          datafeed: datafeed,
          theme: 'dark',
          style: '1', // Candlesticks for both - market cap now has proper OHLC
          toolbar_bg: '#231F20',
          loading_screen: {
            backgroundColor: '#231F20',
            foregroundColor: '#D0B284',
          },
          // Apply custom price formatter for zero-count notation (0.0₅487)
          // This formatter displays tiny prices like 0.000001 as 0.0₅1 (subscript notation)
          custom_formatters: {
            priceFormatterFactory: () => {
              return {
                format: (price: number) => {
                  try {
                    return formatPriceWithZeroCount(price);
                  } catch (error) {
                    console.error('[TradingView] Price formatter error:', error, { price });
                    // Fallback to simple formatting
                    return `$${price.toFixed(8)}`;
                  }
                },
              };
            },
          },
          overrides: {
            'paneProperties.background': '#231F20',
            'paneProperties.vertGridProperties.color': 'rgba(208, 178, 132, 0.1)',
            'paneProperties.horzGridProperties.color': 'rgba(208, 178, 132, 0.1)',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#DCDDCC',
            'mainSeriesProperties.candleStyle.upColor': '#00C896',
            'mainSeriesProperties.candleStyle.downColor': '#FF5B5B',
            'mainSeriesProperties.candleStyle.borderUpColor': '#00C896',
            'mainSeriesProperties.candleStyle.borderDownColor': '#FF5B5B',
            'mainSeriesProperties.candleStyle.wickUpColor': '#00C896',
            'mainSeriesProperties.candleStyle.wickDownColor': '#FF5B5B',
            'mainSeriesProperties.hollowCandleStyle.upColor': '#00C896',
            'mainSeriesProperties.hollowCandleStyle.downColor': '#FF5B5B',
            'mainSeriesProperties.hollowCandleStyle.borderUpColor': '#00C896',
            'mainSeriesProperties.hollowCandleStyle.borderDownColor': '#FF5B5B',
            'mainSeriesProperties.hollowCandleStyle.wickUpColor': '#00C896',
            'mainSeriesProperties.hollowCandleStyle.wickDownColor': '#FF5B5B',
            'scalesProperties.autoScale': true,
            'scalesProperties.scaleMode': 0,
            'scalesProperties.alignLabels': true,
            'paneProperties.topMargin': 10,
            'paneProperties.bottomMargin': 10,
            // Removed extremely small minTick - let TradingView auto-calculate based on pricescale
            'mainSeriesProperties.priceAxisProperties.percentage': false,
            'mainSeriesProperties.priceAxisProperties.autoScale': true,
            // Enable logarithmic scale to handle extreme price ranges (0.000000001 to 0.001)
            // This makes small price movements visible even when prices vary by orders of magnitude

            // Show last value but hide symbol labels from price axis
            'scalesProperties.showSeriesLastValue': true,
            'scalesProperties.showStudyLastValue': false,
            'scalesProperties.showSymbolLabels': false,
          },
          studies_overrides: {
            'volume.volume.color.0': '#FF5B5B',
            'volume.volume.color.1': '#00C896',
            'volume.volume.transparency': 70,
          },
          time_frames: [
            { text: '1m', resolution: '1', description: '1 Minute' },
            { text: '5m', resolution: '5', description: '5 Minutes' },
            { text: '15m', resolution: '15', description: '15 Minutes' },
            { text: '1h', resolution: '60', description: '1 Hour' },
            { text: '4h', resolution: '240', description: '4 Hours' },
            { text: '1d', resolution: '1D', description: '1 Day' },
          ],
        });

        widgetRef.current.onChartReady(() => {
          setIsReinitializing(false);

          // Create custom buttons using TradingView API
          createCustomButtons();
        });
      } catch (err) {
        console.error('[TradingView] Error initializing:', err);
        setError('Failed to initialize chart');
        setIsReinitializing(false);
      }

      return () => {
        if (widgetRef.current) {
          try {
            widgetRef.current.remove();
          } catch (e) {
            console.warn('[TradingView] Error removing widget');
          }
          widgetRef.current = null;
        }
        // Cleanup datafeed on unmount
        cleanupDatafeed();
      };
    }, [
      isLibraryLoaded,
      tokenAddress,
      // Removed tokenSymbol to prevent re-initialization when only the symbol changes
      // The stableTokenSymbol ref will be used instead
      chartMode,
      currency,
      hideNativeHeader,
      cleanupDatafeed, // Include cleanup function in dependencies
    ]);

    useEffect(() => {
      chartModeRef.current = chartMode;
    }, [chartMode]);

    // Handle mode change (requires chart recreation for now)
    const handleModeChange = (newMode: 'price' | 'mcap') => {
      // Mode change requires recreation since we need a different datafeed
      setChartMode(newMode);
    };

    // Update button appearance
    const updateButtonAppearance = useCallback(() => {
      const priceButton = priceOptionRef.current;
      const mcapButton = mcapOptionRef.current;

      if (modeButtonRef.current) {
        modeButtonRef.current.setAttribute('data-mode', chartMode);
      }

      if (priceButton) {
        const isPriceActive = chartMode === 'price';
        priceButton.dataset.active = isPriceActive ? 'true' : 'false';
        priceButton.setAttribute('aria-pressed', isPriceActive ? 'true' : 'false');
      }

      if (mcapButton) {
        const isMcapActive = chartMode === 'mcap';
        mcapButton.dataset.active = isMcapActive ? 'true' : 'false';
        mcapButton.setAttribute('aria-pressed', isMcapActive ? 'true' : 'false');
      }
    }, [chartMode]);

    // Create custom buttons using TradingView API
    const createCustomButtons = async () => {
      if (!widgetRef.current) return;

      try {
        ensureTradingViewToolbarStyles();

        // Wait for header to be ready before creating buttons
        await widgetRef.current.headerReady();

        // Price/MCap toggle button (USD-only)
        const modeButton = widgetRef.current.createButton();
        modeButton.setAttribute('title', 'Toggle Price / Market Cap (USD)');
        modeButton.classList.add('apply-common-tooltip');
        modeButton.classList.add('aces-tv-mode-button');
        modeButton.innerHTML = '';
        modeButtonRef.current = modeButton;

        const wrapper = document.createElement('div');
        wrapper.className = 'aces-tv-mode-toggle';

        const createOptionButton = (label: string, mode: 'price' | 'mcap') => {
          const optionButton = document.createElement('button');
          optionButton.type = 'button';
          optionButton.className = 'aces-tv-mode-option';
          optionButton.dataset.mode = mode;
          optionButton.dataset.active = chartMode === mode ? 'true' : 'false';
          optionButton.dataset.interacting = 'false';
          optionButton.setAttribute('aria-pressed', chartMode === mode ? 'true' : 'false');
          optionButton.setAttribute('aria-label', `${label} chart mode`);
          optionButton.textContent = label;
          optionButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (chartModeRef.current !== mode) {
              handleModeChange(mode);
            }
          });
          optionButton.addEventListener('mousedown', () => {
            optionButton.dataset.interacting = 'true';
          });
          optionButton.addEventListener('mouseup', () => {
            optionButton.dataset.interacting = 'false';
          });
          optionButton.addEventListener('mouseleave', () => {
            optionButton.dataset.interacting = 'false';
          });
          return optionButton;
        };

        const priceButton = createOptionButton('Price', 'price');
        const mcapButton = createOptionButton('MCap', 'mcap');

        priceOptionRef.current = priceButton;
        mcapOptionRef.current = mcapButton;

        wrapper.appendChild(priceButton);
        wrapper.appendChild(mcapButton);
        modeButton.appendChild(wrapper);

        // Initial render
        updateButtonAppearance();
      } catch (err) {
        console.error('[TradingView] Error creating toolbar buttons:', err);
      }
    };

    // Update button appearance when state changes
    useEffect(() => {
      updateButtonAppearance();
    }, [updateButtonAppearance]);

    // Header height tracking
    useEffect(() => {
      if (hideNativeHeader || !isLibraryLoaded || !widgetRef.current) {
        return;
      }

      let isActive = true;
      let headerElement: HTMLElement | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resizeObserver: any = null;

      const setHeaderHeight = () => {
        if (!isActive || !headerElement) return;
        const height = headerElement.getBoundingClientRect().height;
        if (height > 0) {
          document.documentElement.style.setProperty('--tradingview-header-height', `${height}px`);
        }
      };

      const attachTracking = () => {
        if (!chartContainerRef.current) return;
        headerElement = chartContainerRef.current.querySelector(
          '.chart-controls-bar',
        ) as HTMLElement;
        if (!headerElement) return;

        setHeaderHeight();
        if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
          resizeObserver = new window.ResizeObserver(setHeaderHeight);
          resizeObserver.observe(headerElement);
        }
      };

      const widget = widgetRef.current;
      if (widget?.headerReady) {
        widget.headerReady().then(() => {
          if (isActive) attachTracking();
        });
      } else {
        attachTracking();
      }

      window.addEventListener('resize', setHeaderHeight);

      return () => {
        isActive = false;
        window.removeEventListener('resize', setHeaderHeight);
        resizeObserver?.disconnect();
        document.documentElement.style.removeProperty('--tradingview-header-height');
      };
    }, [hideNativeHeader, isLibraryLoaded, tokenAddress]);

    // Error display
    if (error) {
      const containerStyle: React.CSSProperties = {};
      if (typeof heightPx === 'number') containerStyle.height = `${heightPx}px`;
      if (typeof minHeightPx === 'number') containerStyle.minHeight = `${minHeightPx}px`;

      const containerClass =
        typeof heightPx === 'number'
          ? 'flex flex-col w-full bg-[#231f20]/50 overflow-hidden'
          : `flex flex-col ${heightClass} w-full bg-[#231f20]/50 overflow-hidden`;

      return (
        <div className={containerClass} style={containerStyle}>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-400 text-center">
              <div className="text-lg font-semibold mb-2">Chart Error</div>
              <div className="text-sm mb-4">{error}</div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#D0B284]/20 text-[#D0B284] rounded-lg hover:bg-[#D0B284]/30 transition-colors border border-[#D0B284]/20"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    const containerStyle: React.CSSProperties = {};
    if (typeof heightPx === 'number') containerStyle.height = `${heightPx}px`;
    if (typeof minHeightPx === 'number') containerStyle.minHeight = `${minHeightPx}px`;

    const containerClass =
      typeof heightPx === 'number'
        ? 'flex flex-col w-full bg-[#231f20]/50 overflow-hidden'
        : `flex flex-col ${heightClass} w-full bg-[#231f20]/50 overflow-hidden`;

    return (
      <div className={containerClass} style={containerStyle}>
        <div className="w-full h-full bg-[#231F20] relative flex flex-col">
          <div className="flex-1 relative">
            {(isLoading || !isLibraryLoaded || isReinitializing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#231F20]/80 z-30">
                <div className="text-center">
                  {/* <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D0B284] mx-auto mb-4"></div> */}
                  <div className="text-[#DCDDCC]">Loading chart...</div>
                </div>
              </div>
            )}
            <div ref={chartContainerRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: Only re-render if tokenAddress actually changes
    // Ignore changes to tokenSymbol and other props to prevent unnecessary remounts
    return (
      prevProps.tokenAddress === nextProps.tokenAddress &&
      prevProps.heightPx === nextProps.heightPx &&
      prevProps.minHeightPx === nextProps.minHeightPx &&
      prevProps.heightClass === nextProps.heightClass
    );
  },
);

TradingViewChart.displayName = 'TradingViewChart';

export default TradingViewChart;
