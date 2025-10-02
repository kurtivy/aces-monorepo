'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ethers } from 'ethers';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';

const ONE_ETHER = 10n ** 18n;

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

export default function BondingCurveChart({ tokenAddress }: BondingCurveChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [bondingCurveData, setBondingCurveData] = useState<
    Array<{
      tokensSold: number;
      priceACES: number;
      phase: string;
    }>
  >([]);

  // Simple hook - gets all data we need
  const bondingData = useTokenBondingData(tokenAddress);

  const currentTokensSold = parseFloat(bondingData.currentSupply) || 0;
  const tokensBondedAt = parseFloat(bondingData.tokensBondedAt) || 30000000;
  const clampedCurrentTokensSold = Math.min(currentTokensSold, tokensBondedAt || currentTokensSold);
  const isBonded = bondingData.isBonded;
  const curve = bondingData.curve; // 0 = quadratic, 1 = linear
  const floorPriceACES = parseFloat(bondingData.floorPriceACES) || 0;

  const formatTokenAmount = useCallback((value: number) => {
    if (!Number.isFinite(value)) return '0';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (value >= 1) return value.toFixed(0);
    return value.toFixed(4);
  }, []);

  const formatPriceACES = useCallback((value: number) => {
    if (!Number.isFinite(value)) return '0 ACES';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ACES`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K ACES`;
    if (value >= 1) return `${value.toFixed(2)} ACES`;
    return `${value.toFixed(4)} ACES`;
  }, []);

  const calculatePriceAtSupply = useCallback(
    (supplyPoint: number) => {
      const steepnessRaw = bondingData.steepness;
      const floorWeiRaw = bondingData.floorWei;

      if (!steepnessRaw || !floorWeiRaw) {
        return floorPriceACES;
      }

      const steepness = BigInt(steepnessRaw);
      const floorWei = BigInt(floorWeiRaw);

      if (steepness === 0n) {
        return floorPriceACES;
      }

      if (supplyPoint <= 0) {
        return floorPriceACES;
      }

      const supplyInt = BigInt(Math.max(1, Math.floor(supplyPoint)));
      const amountInt = 1n;

      const calculateQuadratic = () => {
        const supplyMinusOne = supplyInt - 1n;
        const sum1 =
          (supplyMinusOne * supplyInt * (2n * supplyMinusOne + 1n)) /
          6n;
        const supplyMinusOnePlusAmount = supplyMinusOne + amountInt;
        const supplyPlusAmount = supplyInt + amountInt;
        const sum2 =
          (supplyMinusOnePlusAmount * supplyPlusAmount * (2n * supplyMinusOnePlusAmount + 1n)) /
          6n;
        const summation = sum2 - sum1;
        return (summation * ONE_ETHER) / steepness + floorWei * amountInt;
      };

      const calculateLinear = () => {
        const sum1 = (supplyInt - 1n) * supplyInt;
        const sum2 = (supplyInt - 1n + amountInt) * (supplyInt + amountInt);
        const summation = sum2 - sum1;
        const steepnessDivisor = (() => {
          const divisor = steepness / 50n;
          return divisor > 0n ? divisor : 1n;
        })();
        return (summation * ONE_ETHER) / steepnessDivisor + floorWei * amountInt;
      };

      const priceWei = curve === 0 ? calculateQuadratic() : calculateLinear();

      try {
        const formatted = ethers.utils.formatEther(priceWei.toString());
        return parseFloat(formatted);
      } catch (error) {
        console.error('Failed to format bonding curve price:', error);
        return floorPriceACES;
      }
    },
    [bondingData.floorWei, bondingData.steepness, curve, floorPriceACES],
  );

  // Generate curve data based on actual curve type
  const generateCurveData = useCallback(() => {
    const dataPoints = [];
    const numPoints = 8;

    for (let i = 0; i <= numPoints; i++) {
      const supplyPoint = Math.floor((tokensBondedAt / numPoints) * i);
      const priceACES = calculatePriceAtSupply(supplyPoint);
      dataPoints.push({
        tokensSold: supplyPoint,
        priceACES,
        phase: supplyPoint <= clampedCurrentTokensSold ? 'completed' : 'upcoming',
      });
    }
    return dataPoints;
  }, [tokensBondedAt, clampedCurrentTokensSold, calculatePriceAtSupply]);

  // Interpolate price from chart data
  const interpolatePriceFromChartData = useCallback(
    (
      targetSupply: number,
      chartData: Array<{ tokensSold: number; priceACES: number; phase: string }>,
    ) => {
      if (chartData.length === 0) return 0;

      const sortedData = [...chartData].sort((a, b) => a.tokensSold - b.tokensSold);

      if (targetSupply <= sortedData[0].tokensSold) {
        return sortedData[0].priceACES;
      }

      if (targetSupply >= sortedData[sortedData.length - 1].tokensSold) {
        return sortedData[sortedData.length - 1].priceACES;
      }

      for (let i = 0; i < sortedData.length - 1; i++) {
        const point1 = sortedData[i];
        const point2 = sortedData[i + 1];

        if (targetSupply >= point1.tokensSold && targetSupply <= point2.tokensSold) {
          const ratio =
            (targetSupply - point1.tokensSold) / (point2.tokensSold - point1.tokensSold);
          return point1.priceACES + (point2.priceACES - point1.priceACES) * ratio;
        }
      }

      const nearestPoint = sortedData.reduce((prev, curr) =>
        Math.abs(curr.tokensSold - targetSupply) < Math.abs(prev.tokensSold - targetSupply)
          ? curr
          : prev,
      );
      return nearestPoint.priceACES;
    },
    [],
  );

  // Generate curve data when bonding data is available
  useEffect(() => {
    if (!bondingData.loading && tokenAddress) {
      const curveData = generateCurveData();
      setBondingCurveData(curveData);
      console.log('📊 Curve data generated:', {
        curve: curve === 0 ? 'quadratic' : 'linear',
        dataPoints: curveData.length,
      });
    }
  }, [bondingData.loading, tokenAddress, generateCurveData, curve]);

  // D3 rendering
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

    const xScale = d3.scaleLinear().domain([0, tokensBondedAt]).range([0, width]);
    const maxACESPrice = d3.max(bondingCurveData, (d) => d.priceACES) || floorPriceACES || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, (maxACESPrice || 1) * 1.1])
      .range([height, 0]);

    const line = d3
      .line<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y((d) => yScale(d.priceACES))
      .curve(d3.curveMonotoneX);

    // Grid lines
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

    // X-axis
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

    // Y-axis
    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .ticks(4)
        .tickFormat((d) => {
          const value = Number(d);
          if (value === 0) return '0';
          if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
          if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
          if (value >= 1) return value.toFixed(2);
          return value.toFixed(4);
        }),
    );

    yAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '8px');
    yAxis.selectAll('line').style('stroke', '#9CA3AF');
    yAxis.selectAll('path').style('stroke', 'none');

    // Gradient
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

    // Area
    const area = d3
      .area<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y0(height)
      .y1((d) => yScale(d.priceACES))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(bondingCurveData).attr('fill', 'url(#areaGradient)').attr('d', area);

    // Line
    g.append('path')
      .datum(bondingCurveData)
      .attr('fill', 'none')
      .attr('stroke', '#D0B284')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Current position line
    if (currentTokensSold > 0 && !isBonded) {
      const currentX = xScale(Math.min(currentTokensSold, tokensBondedAt));

      g.append('line')
        .attr('x1', currentX)
        .attr('y1', 0)
        .attr('x2', currentX)
        .attr('y2', height)
        .attr('stroke', '#D0B284')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.8);

      g.append('text')
        .attr('x', currentX)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#D0B284')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .text(`${formatTokenAmount(currentTokensSold)} tokens`);
    }

    // Bonding threshold line
    if (!isBonded) {
      const bondingX = xScale(tokensBondedAt);

      g.append('line')
        .attr('x1', bondingX)
        .attr('y1', 0)
        .attr('x2', bondingX)
        .attr('y2', height)
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.6);

      g.append('text')
        .attr('x', bondingX)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#10b981')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .text(`Bonded @ ${formatTokenAmount(tokensBondedAt)} tokens`);
    }

    // Bonded indicator
    if (isBonded) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#10b981')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.3)
        .text('🎉 BONDED');
    }

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9CA3AF')
      .attr('font-size', '10px')
      .text('Price (ACES)');

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
      .on('mousemove', function (event) {
        const [mouseX] = d3.pointer(event, this);

        if (mouseX < 0 || mouseX > width) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        const tokensAtX = Math.max(0, Math.min(tokensBondedAt, xScale.invert(mouseX)));

        if (tokensAtX < 0 || tokensAtX > tokensBondedAt) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

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
          const tooltipHeight = 60;
          const adjustedY =
            relativeY < tooltipHeight + 10 ? relativeY + 20 : relativeY - tooltipHeight;

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
    interpolatePriceFromChartData,
    isBonded,
    formatTokenAmount,
    formatPriceACES,
    floorPriceACES,
  ]);

  return (
    <div className="w-full h-full bg-transparent flex flex-col items-center justify-center relative pb-4">
      {bondingData.loading || bondingCurveData.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D0B284]"></div>
        </div>
      ) : !tokenAddress ? (
        <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-center px-4">
          <div className="text-sm mb-2">🎯</div>
          <div className="text-xs mb-3">No token selected</div>
        </div>
      ) : bondingData.error ? (
        <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-center px-4">
          <div className="text-sm mb-2">📊</div>
          <div className="text-xs mb-3">{bondingData.error}</div>
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
                    {formatTokenAmount(tooltipData.tokensSold)} tokens
                  </div>
                  <div className="text-[#D0B284]">{formatPriceACES(tooltipData.priceACES)}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
