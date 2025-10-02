'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BondingCurveDatafeed } from '@/lib/tradingview/datafeed';

interface TradingViewChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  imageSrc?: string;
  heightClass?: string;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  tokenName = 'Trading Chart',
  imageSrc = '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  heightClass = 'h-[600px] min-h-[400px]',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load TradingView library
  useEffect(() => {
    // Check if library is already loaded
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
      // Only remove if we added it
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize chart when library is loaded
  useEffect(() => {
    if (!isLibraryLoaded || !chartContainerRef.current || !tokenAddress) {
      console.log('[TradingView] Initialization check:', {
        isLibraryLoaded,
        hasContainer: !!chartContainerRef.current,
        tokenAddress,
      });
      return;
    }

    // Validate token address format
    if (!tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('[TradingView] Invalid token address format:', tokenAddress);
      setError('Invalid token address format');
      return;
    }

    console.log('[TradingView] Initializing chart for token:', tokenAddress);

    try {
      const datafeed = new BondingCurveDatafeed(tokenAddress);

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
          'header_saveload',
          'header_settings',
          'header_chart_type',
          'header_compare',
          'header_screenshot',
          'header_fullscreen_button',
          'timeframes_toolbar',
          'volume_force_overlay',
        ],
        charts_storage_url: 'https://saveload.tradingview.com',
        charts_storage_api_version: '1.1',
        client_id: 'tradingview.com',
        user_id: 'public_user_id',
        fullscreen: false,
        autosize: true,
        symbol: tokenSymbol,
        interval: '15', // Default to 15 minutes
        datafeed: datafeed,
        theme: 'dark',
        style: '1', // Candlestick style
        toolbar_bg: '#231F20',
        loading_screen: {
          backgroundColor: '#231F20',
          foregroundColor: '#D0B284',
        },
        overrides: {
          // Chart background and grid
          'paneProperties.background': '#231F20',
          'paneProperties.vertGridProperties.color': 'rgba(208, 178, 132, 0.1)',
          'paneProperties.horzGridProperties.color': 'rgba(208, 178, 132, 0.1)',
          'symbolWatermarkProperties.transparency': 90,
          'scalesProperties.textColor': '#DCDDCC',

          // Candlestick colors (green/red)
          'mainSeriesProperties.candleStyle.upColor': '#00C896',
          'mainSeriesProperties.candleStyle.downColor': '#FF5B5B',
          'mainSeriesProperties.candleStyle.borderUpColor': '#00C896',
          'mainSeriesProperties.candleStyle.borderDownColor': '#FF5B5B',
          'mainSeriesProperties.candleStyle.wickUpColor': '#00C896',
          'mainSeriesProperties.candleStyle.wickDownColor': '#FF5B5B',

          // Hollow candlesticks
          'mainSeriesProperties.hollowCandleStyle.upColor': '#00C896',
          'mainSeriesProperties.hollowCandleStyle.downColor': '#FF5B5B',
          'mainSeriesProperties.hollowCandleStyle.borderUpColor': '#00C896',
          'mainSeriesProperties.hollowCandleStyle.borderDownColor': '#FF5B5B',
          'mainSeriesProperties.hollowCandleStyle.wickUpColor': '#00C896',
          'mainSeriesProperties.hollowCandleStyle.wickDownColor': '#FF5B5B',

          // Force price scale to never go below 0
          'scalesProperties.autoScale': true,
          'scalesProperties.scaleMode': 1, // 0 = linear, 1 = logarithmic (better for bonding curves!)
          'scalesProperties.alignLabels': true,
          'paneProperties.topMargin': 10,
          'paneProperties.bottomMargin': 10,

          // Set minimum visible value (support very small prices)
          'mainSeriesProperties.minTick': '0.000001',

          // Percentage scale mode for better price movement visualization
          'mainSeriesProperties.priceAxisProperties.percentage': false,
          'mainSeriesProperties.priceAxisProperties.autoScale': true,
        },
        studies_overrides: {
          // Volume colors
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
        console.log('TradingView chart ready for', tokenAddress);

        // Add popular technical indicators
        // Uncomment these if you want default indicators
        // widgetRef.current.chart().createStudy('Moving Average', false, false, [20, 'close', 0]);
        // widgetRef.current.chart().createStudy('Relative Strength Index', false, true, [14]);
      });
    } catch (err) {
      console.error('Error initializing TradingView widget:', err);
      setError('Failed to initialize chart');
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (e) {
          console.warn('Error removing TradingView widget:', e);
        }
        widgetRef.current = null;
      }
    };
  }, [isLibraryLoaded, tokenAddress, tokenSymbol]);

  if (error) {
    return (
      <div className={`flex flex-col ${heightClass} w-full bg-[#231f20]/50 overflow-hidden`}>
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

  return (
    <div className={`${heightClass} w-full bg-[#231f20]/50 overflow-hidden`}>
      {/* TradingView Chart Container with Native Headers */}
      <div className="w-full h-full bg-[#231F20] relative">
        {(isLoading || !isLibraryLoaded) && (
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
  );
};

export default TradingViewChart;
