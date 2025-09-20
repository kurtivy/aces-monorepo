'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
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

// Generate bonding curve data from contract
const generateBondingCurveData = async (
  tokenAddress: string,
  currentTokensSold: number,
  calculatePriceAtSupply: (supply: number) => Promise<number>,
) => {
  const data = [];
  const supplyPoints = [
    0, 100000000, 200000000, 300000000, 400000000, 500000000, 600000000, 700000000, 800000000,
  ];

  for (const supplyPoint of supplyPoints) {
    try {
      const priceACES = await calculatePriceAtSupply(supplyPoint);
      data.push({
        tokensSold: supplyPoint,
        priceACES: priceACES,
        phase: supplyPoint <= currentTokensSold ? 'completed' : 'upcoming',
        isFixedPrice: false,
      });
    } catch (error) {
      console.error(`Failed to calculate price at ${supplyPoint}:`, error);
      data.push({
        tokensSold: supplyPoint,
        priceACES: 0,
        phase: 'upcoming',
        isFixedPrice: false,
      });
    }
  }

  return data;
};

export default function BondingCurveChart({
  tokenAddress,
  currentPrice: propCurrentPrice,
  tokensSold: propTokensSold,
}: BondingCurveChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [bondingCurveData, setBondingCurveData] = useState<any[]>([]);

  // Use contract data
  const {
    contractState,
    generateBondingCurveData: generateData,
    calculatePriceAtSupply,
  } = useAcesFactoryContract(tokenAddress);

  // Current tokens sold from contract or props
  const currentTokensSold = contractState.currentSupply
    ? parseFloat(contractState.currentSupply)
    : propTokensSold || 0;

  // Generate bonding curve data when contract data is available
  useEffect(() => {
    if (tokenAddress && !contractState.loading) {
      generateData().then(setBondingCurveData);
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

    const xScale = d3.scaleLinear().domain([0, 800000000]).range([0, width]);
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

    // Add axes - only show 50% (400M) and 100% (800M) marks
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([400000000, 800000000])
          .tickFormat((d: d3.NumberValue) => {
            const value = d.valueOf();
            if (value === 400000000) return '50%';
            if (value === 800000000) return '100%';
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

        if (tokensAtX < 0 || tokensAtX > 800000000) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        // Calculate price in ACES tokens at this supply point
        const priceACES = await calculatePriceAtSupply(tokensAtX);

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
  }, [bondingCurveData, currentTokensSold, calculatePriceAtSupply]);

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
