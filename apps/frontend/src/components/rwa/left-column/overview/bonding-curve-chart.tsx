'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ethers } from 'ethers';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';

interface BondingCurveChartProps {
  tokenAddress?: string;
  currentPrice?: number;
  tokensSold?: number;
}

interface TooltipData {
  tokensSold: number;
  priceACES: number;
  x: number;
  y: number;
}

interface ChartState {
  loading: boolean;
  error: string | null;
  retryCount: number;
  lastRetry: number;
  lastSuccessfulFetch: number;
  useCache: boolean;
}

interface CachedData {
  data: Array<{
    tokensSold: number;
    priceACES: number;
    phase: string;
  }>;
  timestamp: number;
  tokenAddress: string;
}

export default function BondingCurveChart({
  tokenAddress,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentPrice: _propCurrentPrice,
  tokensSold: propTokensSold,
}: BondingCurveChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [bondingCurveData, setBondingCurveData] = useState<
    Array<{
      tokensSold: number;
      priceACES: number;
      phase: string;
    }>
  >([]);
  const [chartState, setChartState] = useState<ChartState>({
    loading: false,
    error: null,
    retryCount: 0,
    lastRetry: 0,
    lastSuccessfulFetch: 0,
    useCache: false,
  });

  // Cache management
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const MAX_RETRY_COUNT = 2; // Reduced from 3
  const MIN_RETRY_INTERVAL = 60000; // 1 minute minimum between retries

  // Cache utility functions
  const getCacheKey = (address: string) => `bonding-curve-${address}`;

  const saveToCache = useCallback((data: CachedData) => {
    try {
      sessionStorage.setItem(getCacheKey(data.tokenAddress), JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }, []);

  const loadFromCache = useCallback(
    (address: string): CachedData | null => {
      try {
        const cached = sessionStorage.getItem(getCacheKey(address));
        if (cached) {
          const parsedData = JSON.parse(cached) as CachedData;
          const isValid = Date.now() - parsedData.timestamp < CACHE_DURATION;
          return isValid ? parsedData : null;
        }
      } catch (error) {
        console.warn('Failed to load from cache:', error);
      }
      return null;
    },
    [CACHE_DURATION],
  );

  // Cache clearing function (available for future use)
  // const clearCache = useCallback((address: string) => {
  //   try {
  //     sessionStorage.removeItem(getCacheKey(address));
  //   } catch (error) {
  //     console.warn('Failed to clear cache:', error);
  //   }
  // }, []);

  // Use new contract hook with correct chain ID
  const {
    contractState,
    generateBondingCurveData: generateData,
    fetchTokenInfo,
    isReady,
    isReadOnly,
  } = useAcesFactoryContract(84532); // Base Sepolia

  // Get current supply and bonding threshold
  const currentTokensSold = contractState.tokenInfo
    ? parseFloat(contractState.currentSupply)
    : propTokensSold || 0;

  const tokensBondedAt = contractState.tokenInfo
    ? parseFloat(ethers.utils.formatEther(contractState.tokenInfo.tokensBondedAt))
    : 800000000; // Default fallback (in token units)

  // Debug logging to understand what data we have
  console.log('Contract state:', {
    loading: contractState.loading,
    error: contractState.error,
    hasTokenInfo: !!contractState.tokenInfo,
    tokensBondedAt: contractState.tokenInfo?.tokensBondedAt,
    currentSupply: contractState.currentSupply,
    tokenAddress,
  });

  // Generate fallback data when contract calls fail
  const generateFallbackData = useCallback(() => {
    const dataPoints = [];
    const numPoints = 8;
    const totalSupply = tokensBondedAt;

    // Generate a typical bonding curve shape
    for (let i = 0; i <= numPoints; i++) {
      const supplyPoint = Math.floor((totalSupply / numPoints) * i);
      // Use a quadratic formula for realistic price progression
      const normalizedSupply = supplyPoint / totalSupply;
      const basePrice = 0.0001;
      const priceMultiplier = 1 + Math.pow(normalizedSupply, 1.5) * 39; // Creates curve from 0.0001 to ~0.004
      const priceACES = basePrice * priceMultiplier;

      dataPoints.push({
        tokensSold: supplyPoint,
        priceACES,
        phase: supplyPoint <= currentTokensSold ? 'completed' : 'upcoming',
      });
    }
    return dataPoints;
  }, [tokensBondedAt, currentTokensSold]);

  // Interpolate price from chart data points (no contract calls needed)
  const interpolatePriceFromChartData = useCallback(
    (
      targetSupply: number,
      chartData: Array<{ tokensSold: number; priceACES: number; phase: string }>,
    ) => {
      if (chartData.length === 0) return 0;

      // Sort data by tokensSold to ensure proper interpolation
      const sortedData = [...chartData].sort((a, b) => a.tokensSold - b.tokensSold);

      // If target is before first point, return first price
      if (targetSupply <= sortedData[0].tokensSold) {
        return sortedData[0].priceACES;
      }

      // If target is after last point, return last price
      if (targetSupply >= sortedData[sortedData.length - 1].tokensSold) {
        return sortedData[sortedData.length - 1].priceACES;
      }

      // Find the two points to interpolate between
      for (let i = 0; i < sortedData.length - 1; i++) {
        const point1 = sortedData[i];
        const point2 = sortedData[i + 1];

        if (targetSupply >= point1.tokensSold && targetSupply <= point2.tokensSold) {
          // Linear interpolation
          const ratio =
            (targetSupply - point1.tokensSold) / (point2.tokensSold - point1.tokensSold);
          return point1.priceACES + (point2.priceACES - point1.priceACES) * ratio;
        }
      }

      // Fallback to nearest point
      const nearestPoint = sortedData.reduce((prev, curr) =>
        Math.abs(curr.tokensSold - targetSupply) < Math.abs(prev.tokensSold - targetSupply)
          ? curr
          : prev,
      );
      return nearestPoint.priceACES;
    },
    [],
  );

  // Retry logic with exponential backoff
  const retryWithBackoff = useCallback(async (fn: () => Promise<unknown>, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;

        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s delay
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, []);

  // Smart data loading with caching and intelligent retry
  const loadBondingCurveData = useCallback(
    async (forceRefresh = false) => {
      if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
        console.warn('Invalid or missing token address:', tokenAddress);
        return;
      }

      if (!isReady) {
        console.log('Contract not ready yet, skipping bonding curve data load');
        return;
      }

      // Check if we should skip this request
      const now = Date.now();
      const timeSinceLastRetry = now - chartState.lastRetry;

      // Skip if we recently failed and haven't waited long enough
      if (!forceRefresh && chartState.error && timeSinceLastRetry < MIN_RETRY_INTERVAL) {
        console.log('Skipping request - too soon after last failure');
        return;
      }

      // Skip if we've hit max retries and it's not a manual refresh
      if (!forceRefresh && chartState.retryCount >= MAX_RETRY_COUNT) {
        console.log('Skipping request - max retries exceeded');
        return;
      }

      // Try to load from cache first
      if (!forceRefresh) {
        const cachedData = loadFromCache(tokenAddress);
        if (cachedData) {
          console.log('Using cached bonding curve data');
          setBondingCurveData(cachedData.data);
          setChartState((prev) => ({
            ...prev,
            loading: false,
            error: null,
            useCache: true,
            lastSuccessfulFetch: cachedData.timestamp,
          }));
          return;
        }
      }

      // Prevent multiple simultaneous requests
      if (chartState.loading && !forceRefresh) {
        console.log('Request already in progress');
        return;
      }

      setChartState((prev) => ({
        ...prev,
        loading: true,
        error: forceRefresh ? null : prev.error,
        useCache: false,
      }));

      try {
        console.log('Attempting to fetch live bonding curve data...');
        const data = (await retryWithBackoff(() => generateData(tokenAddress))) as Array<{
          tokensSold: number;
          priceACES: number;
          phase: string;
        }>;

        if (data && data.length > 0) {
          console.log('Successfully fetched live data');
          setBondingCurveData(data);

          // Save to cache
          const cacheData: CachedData = {
            data,
            timestamp: now,
            tokenAddress,
          };
          saveToCache(cacheData);

          setChartState({
            loading: false,
            error: null,
            retryCount: 0,
            lastRetry: 0,
            lastSuccessfulFetch: now,
            useCache: false,
          });
        } else {
          throw new Error('No data returned from contract');
        }
      } catch (error) {
        console.log('Failed to fetch live data, using fallback');

        // Generate fallback data
        const fallbackData = generateFallbackData();
        setBondingCurveData(fallbackData);

        const errorMessage =
          error instanceof Error
            ? error.message.includes('circuit breaker')
              ? 'Network congestion - showing estimated data'
              : 'Network error - showing estimated data'
            : 'Unable to load live data';

        setChartState((prev) => ({
          loading: false,
          error: errorMessage,
          retryCount: forceRefresh ? 0 : prev.retryCount + 1,
          lastRetry: now,
          lastSuccessfulFetch: prev.lastSuccessfulFetch,
          useCache: false,
        }));
      }
    },
    [
      tokenAddress,
      isReady,
      chartState.loading,
      chartState.error,
      chartState.lastRetry,
      chartState.retryCount,
      generateData,
      retryWithBackoff,
      generateFallbackData,
      loadFromCache,
      saveToCache,
      MIN_RETRY_INTERVAL,
      MAX_RETRY_COUNT,
    ],
  );

  // Automatically fetch token info when tokenAddress changes (before loading bonding curve data)
  useEffect(() => {
    if (tokenAddress && isReady && ethers.utils.isAddress(tokenAddress)) {
      console.log('🔍 Fetching token info for:', tokenAddress);
      fetchTokenInfo(tokenAddress, true).catch((error) => {
        console.error('Failed to fetch token info:', error);
      });
    }
  }, [tokenAddress, isReady, fetchTokenInfo]);

  // Load bonding curve data when token info is available
  useEffect(() => {
    if (tokenAddress && contractState.tokenInfo) {
      console.log('📊 Loading bonding curve data with token info available');
      loadBondingCurveData();
    }
  }, [tokenAddress, contractState.tokenInfo, loadBondingCurveData]);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    if (chartState.loading) {
      const timeout = setTimeout(() => {
        console.log('Loading timeout - forcing fallback data');
        const fallbackData = generateFallbackData();
        setBondingCurveData(fallbackData);
        setChartState((prev) => ({
          ...prev,
          loading: false,
          error: 'Network timeout - showing estimated data',
        }));
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [chartState.loading, generateFallbackData]);

  useEffect(() => {
    if (!svgRef.current || bondingCurveData.length === 0) return;

    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 70, left: 50 };
    const width = 280 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Use dynamic scale based on tokensBondedAt
    const xScale = d3
      .scaleLinear()
      .domain([0, tokensBondedAt]) // Dynamic domain
      .range([0, width]);
    const maxACESPrice = d3.max(bondingCurveData, (d) => d.priceACES) || 0.0004;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxACESPrice * 1.1])
      .range([height, 0]);

    const line = d3
      .line<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y((d) => yScale(d.priceACES))
      .curve(d3.curveMonotoneX);

    // Add horizontal grid lines only - no vertical lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
          .tickValues([0, maxACESPrice as number]),
      );

    g.selectAll('.grid line')
      .style('stroke', '#374151')
      .style('stroke-opacity', 0.3)
      .style('stroke-dasharray', '2,2');

    // Add X-axis with 0%, 50%, and 100% marks
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, tokensBondedAt * 0.5, tokensBondedAt] as number[])
          .tickFormat((d) => {
            const value = Number(d);
            if (value === 0) return '0%';
            const percentage = (value / tokensBondedAt) * 100;
            return `${percentage.toFixed(0)}%`;
          }),
      );

    xAxis.selectAll('text').style('fill', '#D0B284').style('font-size', '12px');
    xAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add Y-axis with formatted ACES prices
    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .tickValues([0, maxACESPrice as number])
        .tickFormat((d) => {
          const value = Number(d);
          if (value === 0) return '0';
          // Format large numbers readably
          if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
          } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
          }
          return `${value.toFixed(4)}`;
        }),
    );

    yAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '8px');
    yAxis.selectAll('line').style('stroke', '#9CA3AF');
    yAxis.selectAll('path').style('stroke', 'none'); // Remove the Y-axis path/line

    // Create gradient
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'areaGradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', height);

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#D0B284')
      .attr('stop-opacity', 0.4);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#D0B284')
      .attr('stop-opacity', 0.1);

    // Add area
    const area = d3
      .area<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y0(height)
      .y1((d) => yScale(d.priceACES))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(bondingCurveData).attr('fill', 'url(#areaGradient)').attr('d', area);

    // Add line
    g.append('path')
      .datum(bondingCurveData)
      .attr('fill', 'none')
      .attr('stroke', '#D0B284')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add current position line (no dot)
    if (currentTokensSold > 0) {
      const currentX = xScale(currentTokensSold);

      g.append('line')
        .attr('x1', currentX)
        .attr('y1', 0)
        .attr('x2', currentX)
        .attr('y2', height)
        .attr('stroke', '#D0B284')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    }

    // Interactive overlay
    const crosshairGroup = g.append('g').attr('class', 'crosshairs').style('display', 'none');

    const verticalLine = crosshairGroup
      .append('line')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.8);

    const horizontalLine = crosshairGroup
      .append('line')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.8);

    const intersectionDot = crosshairGroup
      .append('circle')
      .attr('r', 3)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#D0B284')
      .attr('stroke-width', 1);

    const mouseOverlay = g
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    mouseOverlay
      .on('mousemove', async function (event) {
        const [mouseX] = d3.pointer(event, this);

        if (mouseX < 0 || mouseX > width) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        const tokensAtX = xScale.invert(mouseX);

        if (tokensAtX < 0 || tokensAtX > tokensBondedAt) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        // Calculate price using interpolation from chart data (safer than contract calls)
        const priceACES = interpolatePriceFromChartData(tokensAtX, bondingCurveData);

        const chartX = xScale(tokensAtX);
        const chartY = yScale(priceACES);

        verticalLine.attr('x1', chartX).attr('x2', chartX).attr('y1', 0).attr('y2', height);
        horizontalLine.attr('x1', 0).attr('x2', width).attr('y1', chartY).attr('y2', chartY);
        intersectionDot.attr('cx', chartX).attr('cy', chartY);

        crosshairGroup.style('display', null);

        const containerRect = svgRef.current?.getBoundingClientRect();
        if (containerRect) {
          const relativeX = event.clientX - containerRect.left;
          const relativeY = event.clientY - containerRect.top;

          // Adjust tooltip position to avoid clipping
          // If too close to top (within 80px), show below cursor
          // If too close to bottom, show above cursor
          const tooltipHeight = 60; // Approximate tooltip height
          const adjustedY =
            relativeY < tooltipHeight + 10
              ? relativeY + 20 // Show below cursor if near top
              : relativeY - tooltipHeight; // Show above cursor otherwise

          setTooltipData({
            tokensSold: tokensAtX,
            priceACES,
            x: relativeX,
            y: adjustedY,
          });
        }
      })
      .on('mouseleave', () => {
        crosshairGroup.style('display', 'none');
        setTooltipData(null);
      });
  }, [
    bondingCurveData,
    currentTokensSold,
    tokensBondedAt,
    tokenAddress,
    interpolatePriceFromChartData,
  ]);

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center relative pb-4">
      {chartState.loading ? (
        <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D0B284] mb-2"></div>
          <div className="text-xs">Loading curve data...</div>
          {isReadOnly && <div className="text-xs mt-1 opacity-60">(Read-only mode)</div>}
        </div>
      ) : !isReady ? (
        <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-center px-4">
          <div className="text-sm mb-2">⚡</div>
          <div className="text-xs mb-3">Initializing contracts...</div>
        </div>
      ) : !tokenAddress ? (
        <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-center px-4">
          <div className="text-sm mb-2">🎯</div>
          <div className="text-xs mb-3">No token selected</div>
        </div>
      ) : bondingCurveData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-center px-4">
          <div className="text-sm mb-2">📊</div>
          <div className="text-xs mb-3">
            {chartState.error || 'No bonding curve data available'}
          </div>
          <div className="text-xs mb-3 opacity-60">
            Token: {tokenAddress?.slice(0, 6)}...{tokenAddress?.slice(-4)}
          </div>
          <button
            onClick={() => loadBondingCurveData(true)}
            className="px-3 py-1 text-xs bg-[#D0B284] text-[#231F20] rounded hover:bg-[#E5C490] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', maxWidth: '280px', maxHeight: '240px' }}
          ></svg>

          {tooltipData && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: tooltipData.x + 10,
                top: tooltipData.y,
                transform: tooltipData.x > 200 ? 'translateX(-100%)' : 'none',
              }}
            >
              <div className="bg-[#231F20] border border-[#D0B284] rounded-lg p-2 shadow-xl">
                <div className="text-xs space-y-1">
                  <div className="text-[#FFFFFF] font-semibold">
                    {/* Convert to millions - try without wei conversion first */}
                    {(tooltipData.tokensSold / 1e6).toFixed(2)}M tokens
                  </div>
                  <div className="text-[#D0B284]">
                    {/* Format ACES price */}
                    {tooltipData.priceACES >= 1000000
                      ? `${(tooltipData.priceACES / 1000000).toFixed(2)}M ACES`
                      : tooltipData.priceACES >= 1000
                        ? `${(tooltipData.priceACES / 1000).toFixed(2)}K ACES`
                        : `${tooltipData.priceACES.toFixed(4)} ACES`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
