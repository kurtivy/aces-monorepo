'use client';

import React, { useEffect, useRef, useState } from 'react';
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

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  heightClass = 'h-[600px] min-h-[400px]',
  heightPx,
  minHeightPx,
  hideNativeHeader = false,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReinitializing, setIsReinitializing] = useState(false);
  const [chartMode, setChartMode] = useState<'price' | 'mcap'>('price');
  const [currency, setCurrency] = useState<'usd' | 'aces'>('usd');

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
      const datafeed =
        chartMode === 'price'
          ? new BondingCurveDatafeed(tokenAddress, currency)
          : new MarketCapDatafeed(tokenAddress, currency);

      const chartSymbol =
        chartMode === 'price' ? tokenSymbol : `${tokenSymbol}_MCAP_${currency.toUpperCase()}`;

      widgetRef.current = new window.TradingView.widget({
        container: chartContainerRef.current,
        library_path: '/charting_library/',
        locale: 'en',
        disabled_features: [
          'use_localstorage_for_settings',
          'create_volume_indicator_by_default_once',
          'header_saveload',
        ],
        enabled_features: [
          'study_templates',
          'side_toolbar_in_fullscreen_mode',
          'header_widget',
          'header_widget_dom_node',
          'timeframes_toolbar',
          'volume_force_overlay',
        ],
        charts_storage_url: 'https://saveload.tradingview.com',
        charts_storage_api_version: '1.1',
        client_id: 'tradingview.com',
        user_id: 'public_user_id',
        fullscreen: false,
        autosize: true,
        symbol: chartSymbol,
        interval: '15',
        datafeed: datafeed,
        theme: 'dark',
        style: '1',
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
                // Use the appropriate datafeed's formatPriceWithZeroCount method
                // Note: Both datafeeds have identical static formatters
                const formatter =
                  chartMode === 'price'
                    ? BondingCurveDatafeed.formatPriceWithZeroCount
                    : MarketCapDatafeed.formatPriceWithZeroCount;
                // Show $ symbol only for USD currency
                const showSymbol = currency === 'usd';
                return formatter(price, showSymbol);
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
          'mainSeriesProperties.minTick': 'default',
          'mainSeriesProperties.priceAxisProperties.percentage': false,
          'mainSeriesProperties.priceAxisProperties.autoScale': true,
          // Disable logarithmic scale by default to show actual price values
          'mainSeriesProperties.priceAxisProperties.log': false,
          // Show last value but hide symbol labels from price axis
          'scalesProperties.showSeriesLastValue': true,
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
        console.log('[TradingView] Chart ready');
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
    };
  }, [isLibraryLoaded, tokenAddress, tokenSymbol, chartMode, currency, hideNativeHeader]);

  // Create custom buttons using TradingView API
  const createCustomButtons = async () => {
    if (!widgetRef.current) return;

    try {
      console.log('[TradingView] Creating custom buttons...');

      // Create mode toggle (Price / MCap)
      const modeToggle = await widgetRef.current.createButton();
      modeToggle.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 8px;
        font-size: 13px;
        font-weight: 500;
      `;

      const priceText = document.createElement('span');
      priceText.textContent = 'Price';
      priceText.style.cssText = `
        cursor: pointer;
        padding: 4px 8px;
        font-size: ${chartMode === 'price' ? '14px' : '12px'};
        border-radius: 4px;
        transition: all 0.2s ease;
        color: ${chartMode === 'price' ? '#D0B284' : '#8F9B8F'};
      
      `;
      priceText.onclick = () => setChartMode('price');

      const modeSeparator = document.createElement('span');
      modeSeparator.textContent = '/';
      modeSeparator.style.cssText = `
        color: #4a4a4a;
        user-select: none;
      `;

      const mcapText = document.createElement('span');
      mcapText.textContent = 'MCap';
      mcapText.style.cssText = `
        cursor: pointer;
        padding: 4px 8px;
        font-size: ${chartMode === 'mcap' ? '14px' : '12px'};
        border-radius: 4px;
        transition: all 0.2s ease;
        color: ${chartMode === 'mcap' ? '#D0B284' : '#8F9B8F'};
      
      `;
      mcapText.onclick = () => setChartMode('mcap');

      modeToggle.appendChild(priceText);
      modeToggle.appendChild(modeSeparator);
      modeToggle.appendChild(mcapText);

      // Create currency toggle (USD / ACES)
      const currencyToggle = await widgetRef.current.createButton();
      currencyToggle.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 8px;
        font-size: 13px;
        font-weight: 500;
      `;

      const usdText = document.createElement('span');
      usdText.textContent = 'USD';
      usdText.style.cssText = `
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: ${currency === 'usd' ? '14px' : '12px'};
        transition: all 0.2s ease;
        color: ${currency === 'usd' ? '#D0B284' : '#8F9B8F'};
      `;
      usdText.onclick = () => setCurrency('usd');

      const currencySeparator = document.createElement('span');
      currencySeparator.textContent = '/';
      currencySeparator.style.cssText = `
        color: #4a4a4a;
        user-select: none;
      `;

      const acesText = document.createElement('span');
      acesText.textContent = 'ACES';
      acesText.style.cssText = `
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: ${currency === 'aces' ? '14px' : '12px'};
        transition: all 0.2s ease;
        color: ${currency === 'aces' ? '#D0B284' : '#8F9B8F'};
      `;
      acesText.onclick = () => setCurrency('aces');

      currencyToggle.appendChild(usdText);
      currencyToggle.appendChild(currencySeparator);
      currencyToggle.appendChild(acesText);

      console.log('[TradingView] ✓ Custom buttons created');
    } catch (err) {
      console.error('[TradingView] Failed to create custom buttons:', err);
    }
  };

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
      headerElement = chartContainerRef.current.querySelector('.chart-controls-bar') as HTMLElement;
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
                <div className="text-[#DCDDCC]">Loading professional chart...</div>
              </div>
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export default TradingViewChart;
