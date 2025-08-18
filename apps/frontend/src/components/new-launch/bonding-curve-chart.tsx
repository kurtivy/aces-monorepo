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

// Generate bonding curve data based on the linear curve formula from the contract
const generateBondingCurveData = (
  currentTokensSold: number,
  currentPriceETH: number,
  bondingCurveSupply: number,
  steepness: number,
  floor: number,
) => {
  const data = [];
  const steps = 100;

  // Check if bondingCurveSupply seems like a wei value (too big) and correct it
  const actualBondingCurveSupply = bondingCurveSupply > 1e15 ? 800000000 : bondingCurveSupply;

  // Show a more reasonable range: either current position + 50%, or at least 10K shares
  const minDisplayRange = Math.max(10000, currentTokensSold * 1.5);
  const maxRange = Math.min(
    actualBondingCurveSupply,
    Math.max(minDisplayRange, actualBondingCurveSupply * 0.1),
  );
  const stepSize = maxRange / steps;

  for (let i = 0; i <= steps; i++) {
    const shareCount = i * stepSize;

    // Use the contract's linear curve formula:
    // price = (summation * 1 ether) / (steepness / 50) + (floor * amount)
    // For linear: summation = (supply - 1 + amount) * (supply + amount) - (supply - 1) * supply
    let priceETH: number;

    if (shareCount === 0) {
      priceETH = floor;
    } else {
      const supply = shareCount + 1; // Contract starts with supply of 1
      const amount = 1; // Price for 1 share

      const sum1 = (supply - 1) * supply;
      const sum2 = (supply - 1 + amount) * (supply + amount);
      const summation = sum2 - sum1;

      // Convert from wei to ETH: (summation * 1 ether) / (steepness / 50) + (floor * amount)
      priceETH = summation / (steepness / 50) / 1e18 + floor * amount;
    }

    data.push({
      tokensSold: Math.round(shareCount),
      priceETH: Math.max(priceETH, 0), // Ensure non-negative
      phase: shareCount <= currentTokensSold ? 'completed' : 'upcoming',
      isFixedPrice: false, // Linear curve doesn't have fixed price phase
    });
  }

  return { data, maxRange };
};

// Calculate price at any point on the linear bonding curve
const calculatePriceAtShares = (shareCount: number, steepness: number, floor: number): number => {
  if (shareCount === 0) return floor;

  const supply = shareCount + 1; // Contract starts with supply of 1
  const amount = 1; // Price for 1 share

  const sum1 = (supply - 1) * supply;
  const sum2 = (supply - 1 + amount) * (supply + amount);
  const summation = sum2 - sum1;

  // Convert from wei to ETH
  const priceETH = summation / (steepness / 50) / 1e18 + floor * amount;

  return Math.max(priceETH, 0);
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

  // Use the corrected bonding curve supply (800M shares, not wei)
  const bondingCurveSupply = contractState?.bondingCurveSupply
    ? Number(contractState.bondingCurveSupply) // Should be 800M, not wei
    : 800000000;

  // Linear curve parameters (from your transaction log)
  const steepness = 10000000000000; // From transaction log
  const floor = 0; // From transaction log

  // Generate bonding curve data
  const { data: bondingCurveData, maxRange: displayRange } = useMemo(() => {
    // Apply the same correction here that we do in the generation function
    const correctedBondingCurveSupply = bondingCurveSupply > 1e15 ? 800000000 : bondingCurveSupply;

    return generateBondingCurveData(
      currentSharesSold,
      currentPriceETH,
      correctedBondingCurveSupply,
      steepness,
      floor,
    );
  }, [currentSharesSold, currentPriceETH, bondingCurveSupply, steepness, floor]);

  useEffect(() => {
    if (!svgRef.current || bondingCurveData.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions
    const margin = { top: 30, right: 30, bottom: 50, left: 70 };
    const width = 520 - margin.left - margin.right;
    const height = 440 - margin.top - margin.bottom;

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

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
          .tickValues([0, maxETHPrice * 0.5, maxETHPrice]),
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

    xAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '10px');
    xAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add Y axis with proper formatting for very small ETH values
    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .tickValues([0, maxETHPrice * 0.5, maxETHPrice])
        .tickFormat((d: d3.NumberValue) => {
          const value = d.valueOf();
          if (value === 0) return '0';
          if (value < 0.000001) return `${(value * 1e9).toFixed(2)}e-9 ETH`; // Show in scientific notation
          if (value < 0.001) return `${(value * 1e6).toFixed(2)}µ ETH`; // Show in micro ETH
          return `${value.toFixed(8)} ETH`;
        }),
    );

    yAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '10px');
    yAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add axis labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .style('text-anchor', 'middle')
      .style('fill', '#9CA3AF')
      .style('font-size', '11px')
      .text('Tokens Sold');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 15)
      .attr('x', -height / 2)
      .style('text-anchor', 'middle')
      .style('fill', '#9CA3AF')
      .style('font-size', '11px')
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

      // Current position label
      g.append('text')
        .attr('x', currentX)
        .attr('y', -8)
        .attr('text-anchor', 'middle')
        .style('fill', '#D0B264')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .text(`CURRENT (${currentSharesSold.toLocaleString()})`);

      // Current position dot
      g.append('circle')
        .attr('cx', currentX)
        .attr('cy', currentY)
        .attr('r', 6)
        .attr('fill', '#D0B264')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 0 8px rgba(208, 178, 100, 0.8))');

      // Inner white dot
      g.append('circle')
        .attr('cx', currentX)
        .attr('cy', currentY)
        .attr('r', 3)
        .attr('fill', '#fff');
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

        // Calculate price at this share position using contract formula
        const priceETH = calculatePriceAtShares(sharesAtX, steepness, floor);
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
  }, [
    bondingCurveData,
    displayRange,
    currentSharesSold,
    currentPriceETH,
    steepness,
    floor,
    ethPrice?.current,
  ]);

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center relative">
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', maxWidth: '520px', maxHeight: '440px' }}
      ></svg>

      {/* Interactive Tooltip */}
      {tooltipData && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: tooltipData.x + 10,
            top: (() => {
              const tooltipHeight = 80;
              const isNearTop = tooltipData.y < tooltipHeight + 20;
              const isNearBottom = tooltipData.y > 440 - tooltipHeight - 20;

              if (isNearTop) {
                return tooltipData.y + 20;
              } else if (isNearBottom) {
                return tooltipData.y - tooltipHeight - 10;
              } else {
                return tooltipData.y - tooltipHeight;
              }
            })(),
            transform: tooltipData.x > 400 ? 'translateX(-100%)' : 'none',
          }}
        >
          <div className="bg-[#231F20] border border-[#D0B284] rounded-lg p-3 shadow-xl">
            <div className="text-xs space-y-1">
              <div className="text-[#FFFFFF] font-semibold">
                {tooltipData.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                tokens
              </div>
              <div className="text-[#DCDDCC]">
                ETH:{' '}
                {tooltipData.priceETH < 0.000001
                  ? `${(tooltipData.priceETH * 1e9).toFixed(2)}e-9`
                  : tooltipData.priceETH.toFixed(12)}
              </div>
              <div className="text-[#D7BF75]">
                USD:{' '}
                {tooltipData.priceUSD < 0.01
                  ? `${tooltipData.priceUSD.toFixed(8)}`
                  : tooltipData.priceUSD.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 6,
                      maximumFractionDigits: 6,
                    })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
