'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { formatEther } from 'viem';
import { useBondingCurveContracts } from '@/hooks/contracts/use-bonding-curve-contract';

interface BondingCurveChartProps {
  // Props are now optional since we get data from the hook
  currentPrice?: bigint;
  tokensSold?: bigint;
}

interface TooltipData {
  tokensSold: number;
  priceETH: number;
  priceUSD: number;
  x: number;
  y: number;
}

// Real bonding curve data points from mainnet contract
const BONDING_CURVE_POINTS = [
  { tokens: 0, priceETH: 0 }, // Start at zero
  { tokens: 100000000, priceETH: 0.000124262275681931972 }, // 124262275681931972 wei
  { tokens: 200000000, priceETH: 0.000556691626580835978 }, // 556691626580835978 wei
  { tokens: 300000000, priceETH: 0.001490152083554956957 }, // 1490152083554956957 wei
  { tokens: 400000000, priceETH: 0.003117507677462539845 }, // 3117507677462539845 wei
  { tokens: 500000000, priceETH: 0.00563162243916182958 }, // 5631622439161829580 wei
  { tokens: 600000000, priceETH: 0.009225360399511071099 }, // 9225360399511071099 wei
  { tokens: 700000000, priceETH: 0.014091585589368509339 }, // 14091585589368509339 wei
  { tokens: 800000000, priceETH: 0.020423162039592389238 }, // 20423162039592389238 wei
  { tokens: 875000000, priceETH: 0.025 }, // Extended to 875M with estimated value
];

// Generate bonding curve data from real contract points
const generateBondingCurveData = (currentTokensSold: number) => {
  const data = [];
  const steps = 100;
  const maxTokens = 875000000; // 875M tokens - full range
  const stepSize = maxTokens / steps;

  for (let i = 0; i <= steps; i++) {
    const tokensSold = i * stepSize;

    // Find the price by interpolating between known points
    let priceETH = 0;

    for (let j = 0; j < BONDING_CURVE_POINTS.length - 1; j++) {
      const point1 = BONDING_CURVE_POINTS[j];
      const point2 = BONDING_CURVE_POINTS[j + 1];

      if (tokensSold >= point1.tokens && tokensSold <= point2.tokens) {
        // Linear interpolation between points
        const ratio = (tokensSold - point1.tokens) / (point2.tokens - point1.tokens);
        priceETH = point1.priceETH + (point2.priceETH - point1.priceETH) * ratio;
        break;
      }
    }

    // Handle edge cases
    if (tokensSold <= BONDING_CURVE_POINTS[0].tokens) {
      priceETH = BONDING_CURVE_POINTS[0].priceETH;
    } else if (tokensSold >= BONDING_CURVE_POINTS[BONDING_CURVE_POINTS.length - 1].tokens) {
      priceETH = BONDING_CURVE_POINTS[BONDING_CURVE_POINTS.length - 1].priceETH;
    }

    data.push({
      tokensSold: Math.round(tokensSold),
      priceETH: priceETH,
      phase: tokensSold <= currentTokensSold ? 'completed' : 'upcoming',
      isFixedPrice: false,
    });
  }

  return { data, maxRange: maxTokens };
};

// Calculate price at any point using real contract data interpolation
const calculatePriceAtShares = (shareCount: number): number => {
  // Use the same interpolation logic as generateBondingCurveData
  for (let j = 0; j < BONDING_CURVE_POINTS.length - 1; j++) {
    const point1 = BONDING_CURVE_POINTS[j];
    const point2 = BONDING_CURVE_POINTS[j + 1];

    if (shareCount >= point1.tokens && shareCount <= point2.tokens) {
      // Linear interpolation between points
      const ratio = (shareCount - point1.tokens) / (point2.tokens - point1.tokens);
      return point1.priceETH + (point2.priceETH - point1.priceETH) * ratio;
    }
  }

  // Handle edge cases
  if (shareCount <= BONDING_CURVE_POINTS[0].tokens) {
    return BONDING_CURVE_POINTS[0].priceETH;
  }
  return BONDING_CURVE_POINTS[BONDING_CURVE_POINTS.length - 1].priceETH;
};

export default function BondingCurveChart({
  currentPrice: propCurrentPrice,
  tokensSold: propTokensSold,
}: BondingCurveChartProps) {
  const { contractState, ethPrice } = useBondingCurveContracts();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  // Use contract data - room token supply represents shares in the vault
  const currentSharesSold = contractState?.tokenSupply
    ? Number(contractState.tokenSupply) // This is already in share count, not wei
    : propTokensSold
      ? Number(formatEther(propTokensSold))
      : 0;

  const currentPriceETH = contractState?.currentPrice
    ? Number(formatEther(contractState.currentPrice))
    : propCurrentPrice
      ? Number(formatEther(propCurrentPrice))
      : 0;

  // Generate bonding curve data using real contract points
  const { data: bondingCurveData, maxRange: displayRange } = useMemo(() => {
    return generateBondingCurveData(currentSharesSold);
  }, [currentSharesSold]);

  useEffect(() => {
    if (!svgRef.current || bondingCurveData.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Responsive dimensions based on container size
    const containerWidth = svgRef.current?.parentElement?.clientWidth || 520;
    const containerHeight = svgRef.current?.parentElement?.clientHeight || 440;
    const isMobile = containerWidth < 600;
    
    // Mobile-optimized margins
    const margin = isMobile 
      ? { top: 20, right: 15, bottom: 35, left: 45 }
      : { top: 30, right: 30, bottom: 50, left: 70 };
    
    const width = Math.max(isMobile ? 250 : 300, containerWidth - margin.left - margin.right);
    const height = Math.max(isMobile ? 200 : 250, containerHeight - margin.top - margin.bottom);

    // Create SVG container
    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales - use dynamic range instead of full bonding curve supply
    const xScale = d3.scaleLinear().domain([0, displayRange]).range([0, width]);

    // Calculate max ETH price for Y-axis
    const maxETHPrice = d3.max(bondingCurveData, (d) => d.priceETH) || 0.000001;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxETHPrice * 1.1])
      .range([height, 0]); // Add 10% padding

    // Create line generator
    const line = d3
      .line<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y((d) => yScale(d.priceETH))
      .curve(d3.curveMonotoneX);

    // Add grid lines - use better tick values for the display range
    const xTicks = [0, displayRange * 0.25, displayRange * 0.5, displayRange * 0.75, displayRange];

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-height)
          .tickFormat(() => '')
          .tickValues(xTicks),
      );

    // Use same tick values for grid as Y-axis
    const gridYTickValues = [0, maxETHPrice * 0.5, maxETHPrice];
    if (maxETHPrice > 10 && !gridYTickValues.some((val) => Math.abs(val - 10) < 0.5)) {
      gridYTickValues.splice(-1, 0, 10); // Insert 10 ETH before the max value
      gridYTickValues.sort((a, b) => a - b);
    }

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
          .tickValues(gridYTickValues),
      );

    // Style grid lines
    g.selectAll('.grid line')
      .style('stroke', '#374151')
      .style('stroke-opacity', 0.3)
      .style('stroke-dasharray', '3,3');

    // Add X axis with better formatting
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(xTicks)
          .tickFormat((d: d3.NumberValue) => {
            const value = d.valueOf();
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return Math.round(value).toString();
          }),
      );

    xAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', isMobile ? '9px' : '10px');
    xAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add Y axis with proper formatting for very small ETH values
    // Include 10 ETH as a reference point if it's within range
    const yTickValues = [0, maxETHPrice * 0.5, maxETHPrice];
    if (maxETHPrice > 10 && !yTickValues.some((val) => Math.abs(val - 10) < 0.5)) {
      yTickValues.splice(-1, 0, 10); // Insert 10 ETH before the max value
      yTickValues.sort((a, b) => a - b);
    }

    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .tickValues(yTickValues)
        .tickFormat(() => ''), // Remove all Y-axis labels
    );

    yAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', isMobile ? '9px' : '10px');
    yAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add axis labels with responsive font sizes
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - (isMobile ? 5 : 10))
      .style('text-anchor', 'middle')
      .style('fill', '#9CA3AF')
      .style('font-size', isMobile ? '9px' : '11px')
      .text('Tokens Sold');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + (isMobile ? 12 : 15))
      .attr('x', -height / 2)
      .style('text-anchor', 'middle')
      .style('fill', '#9CA3AF')
      .style('font-size', isMobile ? '9px' : '11px')
      .text('Price (ETH)');

    // Create gradient for the area
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
      .attr('stop-color', '#D0B264')
      .attr('stop-opacity', 0.4);

    gradient
      .append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#F59E0B')
      .attr('stop-opacity', 0.2);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10B981')
      .attr('stop-opacity', 0.1);

    // Add the area
    const area = d3
      .area<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y0(height)
      .y1((d) => yScale(d.priceETH))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(bondingCurveData).attr('fill', 'url(#areaGradient)').attr('d', area);

    // Add gradient definition for the line
    const lineGradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'bondingGradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', width)
      .attr('y2', 0);

    lineGradient.append('stop').attr('offset', '0%').attr('stop-color', '#D0B264');
    lineGradient.append('stop').attr('offset', '30%').attr('stop-color', '#F59E0B');
    lineGradient.append('stop').attr('offset', '70%').attr('stop-color', '#10B981');
    lineGradient.append('stop').attr('offset', '100%').attr('stop-color', '#6366F1');

    // Add the line
    g.append('path')
      .datum(bondingCurveData)
      .attr('fill', 'none')
      .attr('stroke', 'url(#bondingGradient)')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add current position line and dot
    if (currentSharesSold > 0) {
      const currentX = xScale(currentSharesSold);
      const currentY = yScale(currentPriceETH);

      // Current position line
      g.append('line')
        .attr('x1', currentX)
        .attr('y1', 0)
        .attr('x2', currentX)
        .attr('y2', height)
        .attr('stroke', '#D0B264')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      // Current position label with responsive font size
      g.append('text')
        .attr('x', currentX)
        .attr('y', -8)
        .attr('text-anchor', 'middle')
        .style('fill', '#D0B264')
        .style('font-size', isMobile ? '8px' : '10px')
        .style('font-weight', 'bold')
        .text(isMobile ? 'CURRENT' : `CURRENT (${currentSharesSold.toLocaleString()})`);
    }

    // Interactive crosshairs and tooltip
    const crosshairGroup = g.append('g').attr('class', 'crosshairs').style('display', 'none');

    // Crosshair lines
    const verticalLine = crosshairGroup
      .append('line')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.8);

    const horizontalLine = crosshairGroup
      .append('line')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.8);

    // Intersection dot
    const intersectionDot = crosshairGroup
      .append('circle')
      .attr('r', 4)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#D0B264')
      .attr('stroke-width', 2);

    // Mouse tracking overlay
    const mouseOverlay = g
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    // Mouse event handlers
    mouseOverlay
      .on('mousemove', function (event) {
        const [mouseX] = d3.pointer(event, this);

        // Constrain to chart bounds
        if (mouseX < 0 || mouseX > width) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        // Convert mouse X to share position
        const sharesAtX = xScale.invert(mouseX);

        // Constrain to display range
        if (sharesAtX < 0 || sharesAtX > displayRange) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        // Calculate price at this share position using real contract data
        const priceETH = calculatePriceAtShares(sharesAtX);
        const priceUSD = priceETH * (ethPrice?.current || 3000);

        // Convert back to chart coordinates
        const chartX = xScale(sharesAtX);
        const chartY = yScale(priceETH);

        // Update crosshairs
        verticalLine.attr('x1', chartX).attr('x2', chartX).attr('y1', 0).attr('y2', height);
        horizontalLine.attr('x1', 0).attr('x2', width).attr('y1', chartY).attr('y2', chartY);
        intersectionDot.attr('cx', chartX).attr('cy', chartY);

        crosshairGroup.style('display', null);

        // Get mouse position relative to the container for tooltip
        const containerRect = svgRef.current?.getBoundingClientRect();
        if (containerRect) {
          setTooltipData({
            tokensSold: sharesAtX,
            priceETH,
            priceUSD,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
          });
        }
      })
      .on('mouseleave', function () {
        crosshairGroup.style('display', 'none');
        setTooltipData(null);
      });
    // Add resize listener for responsive behavior
    const handleResize = () => {
      if (svgRef.current) {
        const resizeEvent = new Event('resize');
        window.dispatchEvent(resizeEvent);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bondingCurveData, displayRange, currentSharesSold, currentPriceETH, ethPrice?.current]);

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center relative">
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }}></svg>

      {/* Interactive Tooltip - Mobile optimized */}
      {tooltipData && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: (() => {
              const containerWidth = svgRef.current?.parentElement?.clientWidth || 520;
              const isMobile = containerWidth < 600;
              const tooltipWidth = isMobile ? 140 : 160;
              
              // Mobile: center tooltip above/below point
              if (isMobile) {
                return Math.max(10, Math.min(containerWidth - tooltipWidth - 10, tooltipData.x - tooltipWidth / 2));
              }
              
              // Desktop: offset to the right, flip if near edge
              return tooltipData.x > containerWidth - 200 ? tooltipData.x - 170 : tooltipData.x + 10;
            })(),
            top: (() => {
              const containerWidth = svgRef.current?.parentElement?.clientWidth || 520;
              const containerHeight = svgRef.current?.parentElement?.clientHeight || 440;
              const isMobile = containerWidth < 600;
              const tooltipHeight = isMobile ? 60 : 80;
              
              if (isMobile) {
                // Mobile: position above or below the point
                return tooltipData.y < containerHeight / 2 
                  ? tooltipData.y + 20  // Position below if in upper half
                  : tooltipData.y - tooltipHeight - 20;  // Position above if in lower half
              }
              
              // Desktop behavior (existing logic)
              const isNearTop = tooltipData.y < tooltipHeight + 20;
              const isNearBottom = tooltipData.y > containerHeight - tooltipHeight - 20;

              if (isNearTop) {
                return tooltipData.y + 20;
              } else if (isNearBottom) {
                return tooltipData.y - tooltipHeight - 10;
              } else {
                return tooltipData.y - tooltipHeight;
              }
            })(),
          }}
        >
          <div className="bg-[#231F20] border border-[#D0B284] rounded-lg p-2 sm:p-3 shadow-xl">
            <div className="text-xs sm:text-sm space-y-1">
              <div className="text-[#FFFFFF] font-semibold">
                {tooltipData.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                tokens
              </div>
              <div className="text-[#D0B284] text-xs">
                {tooltipData.priceETH.toFixed(6)} ETH
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
