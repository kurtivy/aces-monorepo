'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BondingCurveDatafeed } from '@/lib/tradingview/datafeed';
import { MarketCapDatafeed } from '@/lib/tradingview/market-cap-datafeed';

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
    const currencyButtonRef = useRef<HTMLElement | null>(null);
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isReinitializing, setIsReinitializing] = useState(false);

    // Chart mode (USD-only)
    const [chartMode, setChartMode] = useState<'price' | 'mcap'>('price');
    const currency: 'usd' = 'usd';

    // Stabilize tokenSymbol to prevent unnecessary re-renders
    const stableTokenSymbol = useRef(tokenSymbol);
    useEffect(() => {
      // Only update if tokenAddress changes (new token), not just symbol changes
      stableTokenSymbol.current = tokenSymbol;
    }, [tokenAddress]); // Only depends on tokenAddress, not tokenSymbol

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

      setIsReinitializing(true);
      setError(null);

      try {
        // Create datafeed with current mode/currency
        const datafeed =
          chartMode === 'price'
            ? new BondingCurveDatafeed(tokenAddress, currency)
            : new MarketCapDatafeed(tokenAddress, currency);

        datafeedRef.current = datafeed;

        // Expose datafeed to window for debugging
        if (typeof window !== 'undefined') {
          (window as any).__tradingViewDatafeed = datafeed;
          console.log(
            '[TradingView] 🔧 Datafeed exposed to window.__tradingViewDatafeed for debugging',
          );
          console.log(
            '[TradingView] 🔧 Use: window.__tradingViewDatafeed.clearCache() to clear cache',
          );
        }

        const chartSymbol =
          chartMode === 'price'
            ? stableTokenSymbol.current
            : `${stableTokenSymbol.current}_MCAP_${currency.toUpperCase()}`;

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
                  const formatter =
                    chartMode === 'price'
                      ? BondingCurveDatafeed.formatPriceWithZeroCount
                      : MarketCapDatafeed.formatPriceWithZeroCount;
                  return formatter(price, true);
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
            // Set extremely small minTick to handle micro USD prices (0.000000001)
            'mainSeriesProperties.minTick': '0.000000000000000001',
            'mainSeriesProperties.priceAxisProperties.percentage': false,
            'mainSeriesProperties.priceAxisProperties.autoScale': true,
            // Enable logarithmic scale to handle extreme price ranges (0.000000001 to 0.001)
            // This makes small price movements visible even when prices vary by orders of magnitude
            'mainSeriesProperties.priceAxisProperties.log': true,
            // Force minimum price movement to be visible
            'mainSeriesProperties.priceAxisProperties.minMove': 0.000000000000000001,
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
          // console.log('[TradingView] Chart ready');
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
        datafeedRef.current = null;
      };
    }, [
      isLibraryLoaded,
      tokenAddress,
      // Removed tokenSymbol to prevent re-initialization when only the symbol changes
      // The stableTokenSymbol ref will be used instead
      chartMode,
      currency,
      hideNativeHeader,
    ]);

    // Handle currency change without recreating chart
    const handleCurrencyChange = (newCurrency: 'usd' | 'aces') => {
      if (!datafeedRef.current || !widgetRef.current) {
        console.warn('[TradingView] Cannot change currency: chart not ready');
        return;
      }

      // console.log(`[TradingView] Switching currency to ${newCurrency}`);

      // USD-only: ignore currency changes
    };

    // Handle mode change (requires chart recreation for now)
    const handleModeChange = (newMode: 'price' | 'mcap') => {
      // console.log(`[TradingView] Switching mode to ${newMode}`);
      // Mode change requires recreation since we need a different datafeed
      setChartMode(newMode);
    };

    // Update button appearance
    const updateButtonAppearance = useCallback(() => {
      if (modeButtonRef.current) {
        modeButtonRef.current.innerHTML = `
          <div style="display: flex; align-items: center; gap: 4px; padding: 2px; background: rgba(0,0,0,0.3); border-radius: 4px;">
            <span style="padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; background: ${chartMode === 'price' ? '#10b981' : 'transparent'}; color: ${chartMode === 'price' ? 'white' : '#999'}; cursor: pointer;">Price</span>
            <span style="padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; background: ${chartMode === 'mcap' ? '#10b981' : 'transparent'}; color: ${chartMode === 'mcap' ? 'white' : '#999'}; cursor: pointer;">MCap</span>
          </div>
        `;
      }

      // USD-only: remove currency toggle
    }, [chartMode, currency]);

    // Create custom buttons using TradingView API
    const createCustomButtons = async () => {
      if (!widgetRef.current) return;

      try {
        // console.log('[TradingView] Creating toolbar buttons...');

        // Price/MCap toggle button
        const modeButton = widgetRef.current.createButton();
        modeButton.setAttribute('title', 'Toggle Price / Market Cap');
        modeButton.classList.add('apply-common-tooltip');
        modeButtonRef.current = modeButton;
        modeButton.addEventListener('click', () => {
          const newMode = chartMode === 'price' ? 'mcap' : 'price';
          handleModeChange(newMode);
        });

        // USD-only: no currency toggle button

        // Initial render
        updateButtonAppearance();

        // console.log('[TradingView] ✅ Toolbar buttons created');
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D0B284] mx-auto mb-4"></div>
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
