import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  LineStyle,
  PriceScaleMode,
  ColorType,
  LineWidth,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
// import Image from 'next/image';
import { Decimal } from 'decimal.js';
import { useLivePrice } from '@/hooks/rwa/use-live-price';
import { TokensApi, type TokenData, type ChartData } from '@/lib/api/tokens';

interface TradingChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  title?: string;
  imageSrc?: string;
  height?: string;
}

const TradingChart: React.FC<TradingChartProps> = ({
  tokenAddress,
  // tokenSymbol = 'TOKEN',
  // title = 'Trading Chart',
  // imageSrc = '/canvas-image/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  height = 'h-[600px]',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [priceChange24h, setPriceChange24h] = useState<string>('0');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // Add live price hook
  const { livePrice, isConnected } = useLivePrice(tokenAddress, 30000);

  // Calculate 24h percentage change
  const calculate24hChange = useCallback((currentPrice: string, chartData: ChartData) => {
    if (!chartData.candles.length || !currentPrice || currentPrice === 'undefined') return '0';

    // Get price from 24 hours ago (or earliest available)
    const oneDayAgo = Date.now() / 1000 - 24 * 60 * 60;
    const dayAgoCandle =
      chartData.candles.find((candle) => candle.time >= oneDayAgo) || chartData.candles[0];

    if (!dayAgoCandle || dayAgoCandle.open === 0) return '0';

    try {
      const current = new Decimal(currentPrice);
      const previous = new Decimal(dayAgoCandle.open);
      return current.minus(previous).div(previous).mul(100).toFixed(2);
    } catch (error) {
      console.warn('Error calculating 24h change:', error, { currentPrice, dayAgoCandle });
      return '0';
    }
  }, []);

  // Fetch token data and chart data - now using useCallback
  const fetchData = useCallback(async () => {
    try {
      // Smart caching: don't refetch if we just got fresh data
      const now = Date.now();
      if (now - lastSyncTime < 30000) {
        // 30 second cache
        return;
      }

      setIsLoading(true);
      setError(null);

      // Fetch token info
      const tokenResult = await TokensApi.getTokenData(tokenAddress);
      console.log('Token API result:', tokenResult);

      if (tokenResult.success && tokenResult.data) {
        console.log('Token data:', tokenResult.data);
        setTokenData(tokenResult.data);
      }

      // Fetch chart data
      const chartResult = await TokensApi.getChartData(tokenAddress, timeframe);
      console.log('Chart API result:', chartResult);

      console.log('Checking conditions:', {
        success: chartResult.success,
        hasData: chartResult.success ? !!chartResult.data : false,
        hasCandles: chartResult.success ? !!(chartResult.data as any)?.data?.candles : false,
        candleLength: chartResult.success ? (chartResult.data as any)?.data?.candles?.length : 0,
      });

      if (
        chartResult.success &&
        chartResult.data &&
        (chartResult.data as any).data &&
        (chartResult.data as any).data.candles &&
        (chartResult.data as any).data.candles.length > 0
      ) {
        const { candles, volume } = (chartResult.data as any).data;
        console.log('Candles received:', candles.length, 'Volume received:', volume.length);

        // Calculate 24h price change
        if (tokenResult.success && tokenResult.data && (chartResult.data as any).data) {
          const currentPrice = tokenResult.data.currentPriceACES;
          if (currentPrice && currentPrice !== 'undefined' && currentPrice !== '0') {
            const pctChange = calculate24hChange(currentPrice, (chartResult.data as any).data);
            setPriceChange24h(pctChange);
          }
        }

        // Update chart series
        console.log('About to update chart series:', {
          hasCandlestickSeries: !!candlestickSeries.current,
          hasVolumeSeries: !!volumeSeries.current,
          candleCount: candles.length,
          volumeCount: volume.length,
        });

        if (candlestickSeries.current && candles.length > 0) {
          const candleData = candles.map(
            (c: { time: number; open: number; high: number; low: number; close: number }) => ({
              time: Math.floor(c.time) as UTCTimestamp,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }),
          );

          console.log('Setting candle data:', candleData);
          candlestickSeries.current.setData(candleData);
        } else {
          console.log('Chart series not ready or no candles:', {
            hasSeries: !!candlestickSeries.current,
            candleCount: candles.length,
            candles: candles,
          });
        }

        if (volumeSeries.current && volume.length > 0) {
          const volumeData = volume.map((v: { time: number; value: number; color: string }) => ({
            time: Math.floor(v.time) as UTCTimestamp,
            value: v.value,
            color: v.color,
          }));

          volumeSeries.current.setData(volumeData);
        }

        // Fit chart to data
        if (chart.current) {
          chart.current.timeScale().fitContent();
        }
      } else if (
        chartResult.success &&
        (!chartResult.data ||
          !(chartResult.data as any).data ||
          !(chartResult.data as any).data.candles ||
          (chartResult.data as any).data.candles.length === 0)
      ) {
        // No trading data available
        setError('No trading data available for this timeframe');
      } else if (!chartResult.success) {
        // API error
        setError(chartResult.error || 'Failed to load chart data');
      }

      setLastSyncTime(now);
    } catch (err) {
      setError('Failed to load chart data');
      console.error('Chart data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, timeframe, lastSyncTime, calculate24hChange]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    setLastSyncTime(0); // Reset cache to force immediate fetch
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  // Initialize chart with size-aware initializer
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    // Clean up if re-mounting
    if (chart.current) {
      chart.current.remove();
      chart.current = null;
    }

    let initialized = false;

    const init = () => {
      if (initialized || !el || el.clientWidth === 0 || el.clientHeight === 0) return;

      console.log('Initializing chart with size:', {
        width: el.clientWidth,
        height: el.clientHeight,
      });

      const chartOptions = {
        layout: {
          background: {
            type: ColorType.Solid,
            color: '#231F20',
          },
          textColor: '#DCDDCC',
        },
        grid: {
          vertLines: { color: 'rgba(208, 178, 132, 0.1)' },
          horzLines: { color: 'rgba(208, 178, 132, 0.1)' },
        },
        crosshair: {
          mode: 1 as const,
          vertLine: {
            width: 1 as LineWidth,
            color: 'rgba(208, 178, 132, 0.5)',
            style: LineStyle.Dashed,
          },
          horzLine: {
            width: 1 as LineWidth,
            color: 'rgba(208, 178, 132, 0.5)',
            style: LineStyle.Dashed,
          },
        },
        rightPriceScale: {
          borderColor: 'rgba(208, 178, 132, 0.3)',
          textColor: '#DCDDCC',
          mode: PriceScaleMode.Normal,
          autoScale: true,
        },
        timeScale: {
          borderColor: 'rgba(208, 178, 132, 0.3)',
          textColor: '#DCDDCC',
          timeVisible: true,
          secondsVisible: false,
        },
        width: el.clientWidth,
        height: 400,
      };

      chart.current = createChart(el, chartOptions);
      console.log('Chart created:', chart.current);

      // Add candlestick series
      candlestickSeries.current = chart.current.addSeries(CandlestickSeries, {
        upColor: '#00C896',
        downColor: '#FF5B5B',
        borderDownColor: '#FF5B5B',
        borderUpColor: '#00C896',
        wickDownColor: '#FF5B5B',
        wickUpColor: '#00C896',
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            if (price < 0.001) return price.toExponential(3);
            if (price < 1) return price.toFixed(6);
            return price.toFixed(3);
          },
        },
      });
      console.log('Candlestick series created:', candlestickSeries.current);

      // Add volume series
      volumeSeries.current = chart.current.addSeries(HistogramSeries, {
        color: '#D0B284',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      // Configure volume price scale
      chart.current.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      initialized = true;
    };

    // If already laid out, init now; otherwise observe until it is
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      init();
    } else {
      const ro = new ResizeObserver(() => init());
      ro.observe(el);
      // Fallback: also try on the next frame once
      requestAnimationFrame(init);
      return () => ro.disconnect();
    }

    return () => {
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
    };
  }, []);

  // Load data when component mounts or dependencies change
  useEffect(() => {
    if (tokenAddress) {
      // Initial load
      fetchData();

      // Set up smart polling that respects cache
      const interval = setInterval(() => {
        if (Date.now() - lastSyncTime >= 30000) {
          fetchData();
        }
      }, 10000); // Check every 10 seconds, but only fetch if cache expired

      return () => clearInterval(interval);
    }
  }, [tokenAddress, fetchData, lastSyncTime]);

  // Handle container resize with ResizeObserver
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || !chart.current) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && chart.current) {
        chart.current.applyOptions({
          width: Math.floor(cr.width),
          height: 400,
        });
        chart.current.timeScale().fitContent();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return '0.00';
    if (num < 0.001) return num.toExponential(3);
    return num.toFixed(6);
  };

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num === 0) return '0';
    if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatPercentage = (pct: string) => {
    const num = parseFloat(pct);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const timeframes = ['1h', '4h', '1d']; // Simplified timeframes for MVP

  return (
    <div className={`flex flex-col ${height} w-full bg-[#231f20]/50 overflow-hidden`}>
      {/* Header - Single Row Layout */}
      <div className="p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left side - Timeframe Selector */}
          <div className="flex items-center gap-2">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  timeframe === tf
                    ? 'bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/40'
                    : 'bg-[#231F20]/60 text-[#DCDDCC] border border-[#D0B284]/20 hover:bg-[#D0B284]/10'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Right side - Price, Volume, Status, and Controls */}
          <div className="flex items-center gap-4">
            {(tokenData || livePrice) && (
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {livePrice
                    ? formatPrice(livePrice.price)
                    : formatPrice(tokenData?.currentPriceACES || '0')}{' '}
                  ACES
                </div>
                <div
                  className={`text-sm ${parseFloat(priceChange24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {formatPercentage(priceChange24h)} (24h)
                </div>
                {livePrice && livePrice.percentageChange !== '0' && (
                  <div
                    className={`text-xs ${parseFloat(livePrice.percentageChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {formatPercentage(livePrice.percentageChange)} (live)
                  </div>
                )}
                <div className="text-xs text-[#DCDDCC]">
                  Vol: {formatVolume(tokenData?.volume24h || '0')}
                </div>
              </div>
            )}

            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}
              />
              {isConnected ? 'Live' : 'Offline'}
            </div>

            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="px-3 py-1 rounded text-xs bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/40 hover:bg-[#D0B284]/30 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 w-full bg-[#231F20] rounded-none border-t border-[#D0B284]/20 min-h-[400px] relative pb-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#231F20]/80">
            <div className="text-[#DCDDCC]">Loading chart data...</div>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-center">
              <div>{error}</div>
              <button
                onClick={refreshData}
                className="mt-2 text-sm text-[#D0B284] underline hover:no-underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full pb-0" style={{ height: '400px' }} />
      </div>
    </div>
  );
};

export default TradingChart;
