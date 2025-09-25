'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
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

// Legacy function removed - now using hook's generateBondingCurveData

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

  // Use new contract hook
  const {
    contractState,
    generateBondingCurveData: generateData,
    calculatePriceAtSupply,
  } = useAcesFactoryContract();

  // Get current supply and bonding threshold
  const currentTokensSold = contractState.tokenInfo
    ? parseFloat(contractState.currentSupply)
    : propTokensSold || 0;

  const tokensBondedAt = contractState.tokenInfo
    ? parseFloat(contractState.tokenInfo.tokensBondedAt)
    : 800000000; // Default fallback

  // Generate bonding curve data when contract data is available
  useEffect(() => {
    if (tokenAddress && !contractState.loading) {
      generateData(tokenAddress).then(setBondingCurveData);
    }
  }, [tokenAddress, contractState.loading, generateData]);

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
          .tickValues([0, maxACESPrice]),
      );

    g.selectAll('.grid line')
      .style('stroke', '#374151')
      .style('stroke-opacity', 0.3)
      .style('stroke-dasharray', '2,2');

    // Add axes - show 50% and 100% marks based on dynamic tokensBondedAt
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([tokensBondedAt * 0.5, tokensBondedAt])
          .tickFormat((d: d3.NumberValue) => {
            const value = d.valueOf();
            if (value === tokensBondedAt * 0.5) return '50%';
            if (value === tokensBondedAt) return '100%';
            return '';
          }),
      );

    xAxis.selectAll('text').style('fill', '#D0B284').style('font-size', '12px');
    xAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .tickValues([0, maxACESPrice])
        .tickFormat((d: d3.NumberValue) => {
          const value = d.valueOf();
          if (value === 0) return '0';
          return `${value.toFixed(4)}`;
        }),
    );

    yAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '8px');
    yAxis.selectAll('line, path').style('stroke', '#9CA3AF');

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

        // Calculate price in ACES tokens at this supply point
        const priceACES = await calculatePriceAtSupply(tokenAddress || '', tokensAtX);

        const chartX = xScale(tokensAtX);
        const chartY = yScale(priceACES);

        verticalLine.attr('x1', chartX).attr('x2', chartX).attr('y1', 0).attr('y2', height);
        horizontalLine.attr('x1', 0).attr('x2', width).attr('y1', chartY).attr('y2', chartY);
        intersectionDot.attr('cx', chartX).attr('cy', chartY);

        crosshairGroup.style('display', null);

        const containerRect = svgRef.current?.getBoundingClientRect();
        if (containerRect) {
          setTooltipData({
            tokensSold: tokensAtX,
            priceACES,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
          });
        }
      })
      .on('mouseleave', () => {
        crosshairGroup.style('display', 'none');
        setTooltipData(null);
      });
  }, [bondingCurveData, currentTokensSold, tokensBondedAt, calculatePriceAtSupply, tokenAddress]);

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center relative pb-4">
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', maxWidth: '280px', maxHeight: '240px' }}
      ></svg>

      {tooltipData && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: tooltipData.x + 10,
            top: tooltipData.y - 60,
            transform: tooltipData.x > 200 ? 'translateX(-100%)' : 'none',
          }}
        >
          <div className="bg-[#231F20] border border-[#D0B284] rounded-lg p-2 shadow-xl">
            <div className="text-xs space-y-1">
              <div className="text-[#FFFFFF] font-semibold">
                {tooltipData.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                tokens
              </div>
              <div className="text-[#D0B284]">ACES: {tooltipData.priceACES.toFixed(4)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
