'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { formatEther } from 'viem';
import { useBondingCurveContracts } from '@/hooks/use-ico-contracts';

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

// Generate bonding curve data based on the actual contract formula
const generateBondingCurveData = (
  currentTokensSold: number,
  currentPriceETH: number,
  bondingCurveSupply: number,
  basePrice: number,
) => {
  const data = [];
  const steps = 100; // More data points for smoother curve
  // Show full 8 million tokens range
  const maxRange = bondingCurveSupply;
  const stepSize = maxRange / steps;

  for (let i = 0; i <= steps; i++) {
    const tokensSold = i * stepSize;

    // Use the same formula as the contract: price = BASE_PRICE * (1 + supply/BONDING_CURVE_SUPPLY)^2
    let priceETH: number;

    if (tokensSold >= bondingCurveSupply) {
      // Fixed price after bonding curve completion
      priceETH = basePrice * 2;
    } else {
      const progress = tokensSold / bondingCurveSupply;
      const multiplier = 1 + progress;
      priceETH = basePrice * multiplier * multiplier;
    }

    data.push({
      tokensSold: Math.round(tokensSold),
      priceETH: priceETH,
      phase: tokensSold <= currentTokensSold ? 'completed' : 'upcoming',
      isFixedPrice: tokensSold >= bondingCurveSupply,
    });
  }

  return data;
};

// Calculate price at any point on the bonding curve
const calculatePriceAtTokens = (
  tokensSold: number,
  bondingCurveSupply: number,
  basePrice: number,
): number => {
  if (tokensSold >= bondingCurveSupply) {
    return basePrice * 2; // Fixed price after completion
  }

  const progress = tokensSold / bondingCurveSupply;
  const multiplier = 1 + progress;
  return basePrice * multiplier * multiplier;
};

export default function BondingCurveChart({
  currentPrice: propCurrentPrice,
  tokensSold: propTokensSold,
}: BondingCurveChartProps) {
  const { contractState, ethPrice } = useBondingCurveContracts();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  // Use contract data or fallback to props
  const currentTokensSold = contractState?.tokenSupply
    ? Number(formatEther(contractState.tokenSupply))
    : propTokensSold
      ? Number(formatEther(propTokensSold))
      : 0;

  const currentPriceETH = contractState?.currentPrice
    ? Number(formatEther(contractState.currentPrice))
    : propCurrentPrice
      ? Number(formatEther(propCurrentPrice))
      : 0;

  const bondingCurveSupply = contractState?.bondingCurveSupply
    ? Number(formatEther(contractState.bondingCurveSupply))
    : 8000000;

  const basePrice = contractState?.basePrice
    ? Number(formatEther(contractState.basePrice))
    : 1.7869e-8;

  // Debug logging
  // console.log('🔍 D3 Bonding Curve Chart Debug:');
  // console.log('   currentTokensSold:', currentTokensSold);
  // console.log('   currentPriceETH:', currentPriceETH);
  // console.log('   ethPrice.current:', ethPrice?.current);
  // console.log('   Should show indicator:', currentTokensSold > 0);

  // Generate bonding curve data
  const bondingCurveData = useMemo(() => {
    return generateBondingCurveData(
      currentTokensSold,
      currentPriceETH,
      bondingCurveSupply,
      basePrice,
    );
  }, [currentTokensSold, currentPriceETH, bondingCurveSupply, basePrice]);

  useEffect(() => {
    if (!svgRef.current || bondingCurveData.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions - make chart properly sized for 600px container
    const margin = { top: 30, right: 30, bottom: 50, left: 70 }; // Reduced margins
    const width = 520 - margin.left - margin.right; // 420px chart width to fit 520px SVG
    const height = 440 - margin.top - margin.bottom; // 360px chart height to fit 440px SVG

    // Create SVG container
    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3.scaleLinear().domain([0, bondingCurveSupply]).range([0, width]);

    // Calculate max ETH price for Y-axis (including the peak around 99.99%)
    const maxETHPrice = d3.max(bondingCurveData, (d) => d.priceETH) || 0.000004;

    const yScale = d3.scaleLinear().domain([0, maxETHPrice]).range([height, 0]);

    // Create line generator
    const line = d3
      .line<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y((d) => yScale(d.priceETH))
      .curve(d3.curveMonotoneX);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-height)
          .tickFormat(() => '')
          .tickValues([0, 2000000, 4000000, 6000000, 8000000]),
      );

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
          .tickValues([0, maxETHPrice]),
      );

    // Style grid lines
    g.selectAll('.grid line')
      .style('stroke', '#374151')
      .style('stroke-opacity', 0.3)
      .style('stroke-dasharray', '3,3');

    // Add X axis with explicit tick values
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, 2000000, 4000000, 6000000, 8000000])
          .tickFormat((d: d3.NumberValue) => {
            const value = d.valueOf();
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value.toString();
          }),
      );

    xAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '10px');

    xAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add Y axis with only min and max values
    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .tickValues([0, maxETHPrice])
        .tickFormat((d: d3.NumberValue) => {
          const value = d.valueOf();
          if (value === 0) return '0 ETH';
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

    // Add the line
    g.append('path')
      .datum(bondingCurveData)
      .attr('fill', 'none')
      .attr('stroke', 'url(#bondingGradient)')
      .attr('stroke-width', 2)
      .attr('d', line);

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

    // Add current position line and dot
    if (currentTokensSold > 0) {
      const currentX = xScale(currentTokensSold);
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
        .text(`CURRENT (${currentTokensSold.toLocaleString()})`);

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

        // Convert mouse X to token position
        const tokensAtX = xScale.invert(mouseX);

        // Constrain to bonding curve range
        if (tokensAtX < 0 || tokensAtX > bondingCurveSupply) {
          crosshairGroup.style('display', 'none');
          setTooltipData(null);
          return;
        }

        // Calculate price at this token position
        const priceETH = calculatePriceAtTokens(tokensAtX, bondingCurveSupply, basePrice);
        const priceUSD = priceETH * (ethPrice?.current || 3000);

        // Convert back to chart coordinates
        const chartX = xScale(tokensAtX);
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
            tokensSold: tokensAtX,
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
    currentTokensSold,
    currentPriceETH,
    bondingCurveSupply,
    basePrice,
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
              // Smart positioning: flip to bottom if near top edge
              const tooltipHeight = 80;
              const isNearTop = tooltipData.y < tooltipHeight + 20;
              const isNearBottom = tooltipData.y > 440 - tooltipHeight - 20;

              if (isNearTop) {
                return tooltipData.y + 20; // Position below cursor
              } else if (isNearBottom) {
                return tooltipData.y - tooltipHeight - 10; // Position above cursor
              } else {
                return tooltipData.y - tooltipHeight; // Default above cursor
              }
            })(),
            transform: tooltipData.x > 400 ? 'translateX(-100%)' : 'none', // Flip if near right edge
          }}
        >
          <div className="bg-[#231F20] border border-[#D0B284] rounded-lg p-3 shadow-xl">
            <div className="text-xs space-y-1">
              <div className="text-[#FFFFFF] font-semibold">
                {tooltipData.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                tokens
              </div>
              <div className="text-[#DCDDCC]">ETH: {tooltipData.priceETH.toFixed(12)}</div>
              <div className="text-[#D7BF75]">
                USD:{' '}
                {tooltipData.priceUSD.toLocaleString(undefined, {
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
