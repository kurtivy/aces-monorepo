'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
      gap: 6px;
      padding: 0 18px 0 0;
      background: transparent;
      border: none;
      border-radius: 6px;
      box-shadow: none;
      transition: opacity 0.2s ease;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      position: relative;
      font-size: 14px;
      font-weight: 500;
    }

    .aces-tv-mode-toggle:hover {
      background: transparent;
    }

    .aces-tv-mode-option {
      appearance: none;
      border: none;
      background: transparent;
      color: rgba(226, 232, 240, 0.58);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.01em;
      padding: 0;
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.25s ease, transform 0.1s ease;
      position: relative;
      overflow: hidden;
    }

    .aces-tv-mode-option:focus-visible {
      outline: 1px solid #d0b284;
      outline-offset: 2px;
    }

    .aces-tv-mode-option::before {
      display: none;
    }

    .aces-tv-mode-option:hover {
      color: rgba(226, 232, 240, 0.82);
    }

    .aces-tv-mode-option:active {
      transform: scale(0.97);
    }

    .aces-tv-mode-option[data-interacting='true'] {
      transform: scale(0.96);
    }

    .aces-tv-mode-option[data-active='true'] {
      color: #d0b284;
    }

    .aces-tv-mode-option[data-active='true']::after {
      display: none;
    }

    .aces-tv-mode-option[data-active='false']::after {
      opacity: 0;
    }

    .aces-tv-mode-option[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .aces-tv-mode-toggle[data-loading='true'] {
      pointer-events: none;
      opacity: 0.6;
    }

    .aces-tv-mode-toggle[data-loading='true']::after {
      content: '';
      position: absolute;
      right: 2px;
      top: 50%;
      width: 14px;
      height: 14px;
      border-radius: 9999px;
      border: 2px solid rgba(208, 178, 132, 0.25);
      border-top-color: #d0b284;
      transform: translateY(-50%);
      animation: aces-tv-spin 0.9s linear infinite;
      z-index: 2;
    }

    .aces-tv-mode-toggle[data-loading='true'] .aces-tv-mode-option {
      opacity: 0.4;
    }

    .aces-tv-dark-skin .chart-controls-bar,
    .aces-tv-dark-skin .chart-controls-bar:before,
    .aces-tv-dark-skin .chart-controls-bar:after,
    .aces-tv-dark-skin .layout__area--center,
    .aces-tv-dark-skin .chart-container,
    .aces-tv-dark-skin .chart-widget,
    .aces-tv-dark-skin .tv-side-toolbar,
    .aces-tv-dark-skin .tv-side-toolbar__inner,
    .aces-tv-dark-skin .tv-header__inner,
    .aces-tv-dark-skin .chart-markup-table,
    .aces-tv-dark-skin .layout__area--center:before {
      background-color: #000000 !important;
      background: #000000 !important;
    }

    .aces-tv-dark-skin .tv-side-toolbar__inner {
      border-color: rgba(255, 255, 255, 0.08) !important;
    }

    .aces-tv-dark-skin .chart-controls-bar {
      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    }

    .aces-tv-mode-separator {
      color: rgba(226, 232, 240, 0.35);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.01em;
    }

    @keyframes aces-tv-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
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

    if (zeros >= 3) {
      const subscriptZeros = zeros
        .toString()
        .split('')
        .map((d) => subscriptMap[d] || d)
        .join('');
      return `$0.0${subscriptZeros}${digits}`;
    } else {
      // For 1-2 zeros, use regular format with 3 significant digits
      return `$0.${'0'.repeat(zeros)}${digits}`;
    }
  }

  return `$${price.toFixed(8)}`;
};

const formatMarketCapValue = (value: number): string => {
  if (!Number.isFinite(value)) return '$0';

  const sign = value < 0 ? '-' : '';
  const absValue = Math.abs(value);

  const formatWithSuffix = (val: number, divisor: number, suffix: string) => {
    const scaled = val / divisor;
    const precision = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const formatted = parseFloat(scaled.toFixed(precision));
    return `${formatted}${suffix}`;
  };

  if (absValue >= 1_000_000_000) {
    return `${sign}$${formatWithSuffix(absValue, 1_000_000_000, 'B')}`;
  }

  if (absValue >= 1_000_000) {
    return `${sign}$${formatWithSuffix(absValue, 1_000_000, 'M')}`;
  }

  if (absValue >= 10_000) {
    return `${sign}$${formatWithSuffix(absValue, 1_000, 'K')}`;
  }

  const precision = absValue < 100 ? 2 : 0;
  const formattedBase = absValue
    .toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision,
      useGrouping: false,
    })
    .replace(/\.0+$/, '');

  return `${sign}$${formattedBase}`;
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
  extraEnabledFeatures?: string[];
  extraDisabledFeatures?: string[];
  extraFeatureSets?: string[];
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
    extraEnabledFeatures,
    extraDisabledFeatures,
    extraFeatureSets,
  }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<any>(null);
    const datafeedRef = useRef<any>(null);
    const modeButtonRef = useRef<HTMLElement | null>(null);
    const modeWrapperRef = useRef<HTMLDivElement | null>(null);
    const priceOptionRef = useRef<HTMLButtonElement | null>(null);
    const mcapOptionRef = useRef<HTMLButtonElement | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isReinitializing, setIsReinitializing] = useState(false);
    const [isModeSwitching, setIsModeSwitching] = useState(false);

    // Chart mode (USD-only)
    const [chartMode, setChartMode] = useState<'price' | 'mcap'>('price');
    const chartModeRef = useRef<'price' | 'mcap'>(chartMode);
    const isReinitializingRef = useRef<boolean>(isReinitializing);
    const isModeSwitchingRef = useRef<boolean>(isModeSwitching);
    const currency = 'usd' as const;

    const enabledFeatures = useMemo(() => {
      const baseFeatures = [
        'side_toolbar_in_fullscreen_mode',
        'header_widget',
        'header_widget_dom_node',
        'timeframes_toolbar',
        'volume_force_overlay',
      ];

      if (!extraEnabledFeatures?.length) {
        return baseFeatures;
      }

      return Array.from(new Set([...baseFeatures, ...extraEnabledFeatures]));
    }, [extraEnabledFeatures]);

    const disabledFeatures = useMemo(() => {
      const baseDisabled = [
        'use_localstorage_for_settings',
        'create_volume_indicator_by_default_once',
        'header_saveload',
        'study_templates',
        'header_symbol_search',
        'header_compare',
        'header_indicators',
      ];

      if (!extraDisabledFeatures?.length) {
        return baseDisabled;
      }

      return Array.from(new Set([...baseDisabled, ...extraDisabledFeatures]));
    }, [extraDisabledFeatures]);

    const featureSets = useMemo(() => {
      if (!extraFeatureSets?.length) {
        return undefined;
      }

      return Array.from(new Set(extraFeatureSets));
    }, [extraFeatureSets]);

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

        // Use the new destroy method to properly clean up all connections and subscriptions
        if (typeof datafeedRef.current.destroy === 'function') {
          try {
            datafeedRef.current.destroy();
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
      setIsModeSwitching(false);
      setError(null);

      try {
        if (chartContainerRef.current) {
          chartContainerRef.current.classList.add('aces-tv-dark-skin');
        }
        // Create unified datafeed (handles both price and market cap)
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const wsUrl = (() => {
          if (process.env.NEXT_PUBLIC_WS_URL) {
            return process.env.NEXT_PUBLIC_WS_URL;
          }

          try {
            const apiUrl = new URL(apiBaseUrl);
            const isSecure = apiUrl.protocol === 'https:';
            const wsProtocol = isSecure ? 'wss:' : 'ws:';
            return `${wsProtocol}//${apiUrl.host}/ws/chart`;
          } catch (error) {
            console.warn(
              '[TradingView] Failed to derive WebSocket URL from NEXT_PUBLIC_API_URL, falling back to window.location',
              error,
            );

            if (typeof window !== 'undefined') {
              const isPageSecure = window.location.protocol === 'https:';
              const wsProtocol = isPageSecure ? 'wss:' : 'ws:';
              return `${wsProtocol}//${window.location.host}/ws/chart`;
            }

            return 'ws://localhost:3002/ws/chart';
          }
        })();

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
        const currentMode = chartModeRef.current;
        const chartSymbol = currentMode === 'price' ? tokenAddress : `${tokenAddress}_MCAP`;

        widgetRef.current = new window.TradingView.widget({
          container: chartContainerRef.current,
          library_path: '/charting_library/',
          locale: 'en',
          disabled_features: disabledFeatures,
          enabled_features: enabledFeatures,
          ...(featureSets ? { featuresets: featureSets } : {}),
          // Removed charts_storage_url and related config to prevent CORS errors
          // Users can still draw on charts, but templates won't be saved
          fullscreen: false,
          autosize: true,
          symbol: chartSymbol,
          interval: '1', // Default to 1-minute candles for both price and market cap
          datafeed: datafeed,
          theme: 'dark',
          style: '1', // Candlesticks for both - market cap now has proper OHLC
          toolbar_bg: '#000000',
          loading_screen: {
            backgroundColor: '#000000',
            foregroundColor: '#D0B284',
          },
          // Apply custom price formatter for zero-count notation (0.0₅487)
          // This formatter displays tiny prices like 0.000001 as 0.0₅1 (subscript notation)
          custom_formatters: {
            priceFormatterFactory: () => {
              return {
                format: (price: number) => {
                  try {
                    const mode = chartModeRef.current;
                    const formatter =
                      mode === 'mcap' ? formatMarketCapValue : formatPriceWithZeroCount;

                    return formatter(price);
                  } catch (error) {
                    console.error('[TradingView] Price formatter error:', error, { price });
                    // Fallback to simple formatting
                    const mode = chartModeRef.current;
                    return mode === 'mcap' ? `$${price.toFixed(0)}` : `$${price.toFixed(8)}`;
                  }
                },
              };
            },
          },
          overrides: {
            'paneProperties.background': '#000000',
            'paneProperties.backgroundGradientStartColor': '#000000',
            'paneProperties.backgroundGradientEndColor': '#000000',
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
        currentSymbolRef.current = chartSymbol;

        widgetRef.current.onChartReady(() => {
          setIsReinitializing(false);

          // Create custom buttons using TradingView API
          createCustomButtons();
        });
      } catch (err) {
        console.error('[TradingView] Error initializing:', err);
        setError('Failed to initialize chart');
        setIsReinitializing(false);
        setIsModeSwitching(false);
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
        modeWrapperRef.current = null;
        modeButtonRef.current = null;
        priceOptionRef.current = null;
        mcapOptionRef.current = null;
        // Cleanup datafeed on unmount
        cleanupDatafeed();
      };
    }, [
      isLibraryLoaded,
      tokenAddress,
      // Removed tokenSymbol to prevent re-initialization when only the symbol changes
      // The stableTokenSymbol ref will be used instead
      currency,
      hideNativeHeader,
      cleanupDatafeed, // Include cleanup function in dependencies
    ]);

    useEffect(() => {
      console.log('[TradingView] chartMode state changed:', {
        newMode: chartMode,
        oldMode: chartModeRef.current,
        currentSymbol: currentSymbolRef.current,
      });
      chartModeRef.current = chartMode;
    }, [chartMode]);

    useEffect(() => {
      isReinitializingRef.current = isReinitializing;
    }, [isReinitializing]);

    useEffect(() => {
      isModeSwitchingRef.current = isModeSwitching;
    }, [isModeSwitching]);

    useEffect(() => {
      if (!isLibraryLoaded || !widgetRef.current || !tokenAddress || isReinitializing) {
        return;
      }

      const targetSymbol = chartMode === 'price' ? tokenAddress : `${tokenAddress}_MCAP`;

      if (currentSymbolRef.current === targetSymbol) {
        console.log('[TradingView] Already at target symbol:', targetSymbol);
        setIsModeSwitching(false);
        return;
      }

      const widget = widgetRef.current;
      const getActiveChart =
        typeof widget.activeChart === 'function' ? widget.activeChart : widget.chart;
      const chart = typeof getActiveChart === 'function' ? getActiveChart.call(widget) : null;

      if (!chart) {
        console.warn('[TradingView] No chart instance available');
        setIsModeSwitching(false);
        return;
      }

      if (typeof chart.setSymbol !== 'function') {
        console.warn('[TradingView] chart.setSymbol is not a function. Chart methods:', {
          hasSetSymbol: 'setSymbol' in chart,
          setSymbolType: typeof chart.setSymbol,
          availableMethods: Object.keys(chart).filter((k) => typeof chart[k] === 'function'),
        });
        setIsModeSwitching(false);
        return;
      }

      console.log(`[TradingView] Initiating symbol switch:`, {
        from: currentSymbolRef.current,
        to: targetSymbol,
        mode: chartMode,
        isModeSwitching,
      });

      // Ensure flag is set (may already be set by handleModeChange)
      if (!isModeSwitching) {
        setIsModeSwitching(true);
      }

      let callbackFired = false;

      // Add timeout to prevent getting stuck in loading state
      const timeoutId = setTimeout(() => {
        if (!callbackFired) {
          console.warn(
            '[TradingView] Symbol switch timeout - callback never fired. Force updating refs.',
          );
          currentSymbolRef.current = targetSymbol;
          chartModeRef.current = chartMode;
        }
        setIsModeSwitching(false);
      }, 3000); // 3 second timeout

      try {
        // Get current resolution
        let currentResolution = '1'; // Default to 1-minute if chart does not expose resolution
        try {
          if (typeof chart.resolution === 'function') {
            currentResolution = chart.resolution();
          } else if (chart.resolution) {
            currentResolution = chart.resolution;
          }
        } catch (e) {
          console.warn('[TradingView] Could not get current resolution, using default');
        }

        console.log('[TradingView] Calling chart.setSymbol with resolution:', currentResolution);

        // Use setSymbol with callback
        chart.setSymbol(targetSymbol, currentResolution, () => {
          callbackFired = true;
          clearTimeout(timeoutId);
          console.log(`[TradingView] ✅ Symbol switched successfully to: ${targetSymbol}`);
          currentSymbolRef.current = targetSymbol;
          chartModeRef.current = chartMode;
          setIsModeSwitching(false);
        });
      } catch (symbolError) {
        clearTimeout(timeoutId);
        console.error('[TradingView] ❌ Failed to switch symbol:', symbolError);
        // Reset to previous state on error
        setIsModeSwitching(false);
      }

      // Cleanup: clear timeout if effect re-runs or component unmounts
      return () => {
        clearTimeout(timeoutId);
      };
    }, [chartMode, tokenAddress, isLibraryLoaded, isReinitializing, enabledFeatures, disabledFeatures, featureSets]);

    useEffect(() => {
      const wrapper = modeWrapperRef.current;
      if (!wrapper) return;

      const isBusy = isReinitializing || isModeSwitching;
      wrapper.dataset.loading = isBusy ? 'true' : 'false';

      const buttons = wrapper.querySelectorAll('button');
      buttons.forEach((button) => {
        (button as HTMLButtonElement).disabled = isBusy;
      });
    }, [isReinitializing, isModeSwitching]);

    // Handle mode change by switching the active symbol
    const handleModeChange = useCallback(
      (newMode: 'price' | 'mcap') => {
        const currentMode = chartModeRef.current;
        console.log('[TradingView] handleModeChange called:', {
          newMode,
          currentModeState: currentMode,
          currentModeRef: chartModeRef.current,
          isReinitializing: isReinitializingRef.current,
          isModeSwitching: isModeSwitchingRef.current,
          tokenAddress: tokenAddress?.slice(0, 10),
          currentSymbol: currentSymbolRef.current,
        });

        if (!tokenAddress) {
          console.warn('[TradingView] No token address - blocking mode change');
          return;
        }

        // Check against the latest mode via ref to avoid stale closures
        if (newMode === currentMode) {
          console.log('[TradingView] Already in requested mode (state check) - skipping');
          return;
        }

        if (isReinitializingRef.current) {
          console.warn('[TradingView] Chart is reinitializing - blocking mode change');
          return;
        }

        if (isModeSwitchingRef.current) {
          console.warn('[TradingView] Already switching modes - blocking mode change');
          return;
        }

        console.log(`[TradingView] ▶️  Starting mode change: ${currentMode} → ${newMode}`);
        setIsModeSwitching(true);
        chartModeRef.current = newMode;
        setChartMode(newMode);
      },
      [tokenAddress],
    );

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
        const separator = document.createElement('span');
        separator.className = 'aces-tv-mode-separator';
        separator.textContent = '/';
        const mcapButton = createOptionButton('MCap', 'mcap');

        priceOptionRef.current = priceButton;
        mcapOptionRef.current = mcapButton;

        wrapper.appendChild(priceButton);
        wrapper.appendChild(separator);
        wrapper.appendChild(mcapButton);
        modeButton.appendChild(wrapper);
        modeWrapperRef.current = wrapper;
        wrapper.dataset.loading = isReinitializing || isModeSwitching ? 'true' : 'false';

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
          ? 'flex flex-col w-full bg-black overflow-hidden'
          : `flex flex-col ${heightClass} w-full bg-black overflow-hidden`;

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
        ? 'flex flex-col w-full bg-black overflow-hidden'
        : `flex flex-col ${heightClass} w-full bg-black overflow-hidden`;

    return (
      <div className={containerClass} style={containerStyle}>
        <div className="w-full h-full bg-black relative flex flex-col">
          <div className="flex-1 relative">
            {(isLoading || !isLibraryLoaded || isReinitializing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
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
      prevProps.heightClass === nextProps.heightClass &&
      prevProps.hideNativeHeader === nextProps.hideNativeHeader &&
      prevProps.extraEnabledFeatures === nextProps.extraEnabledFeatures &&
      prevProps.extraDisabledFeatures === nextProps.extraDisabledFeatures &&
      prevProps.extraFeatureSets === nextProps.extraFeatureSets
    );
  },
);

TradingViewChart.displayName = 'TradingViewChart';

export default TradingViewChart;
