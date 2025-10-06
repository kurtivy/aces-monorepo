'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { formatEther } from 'viem';
import { useBondingCurveContracts } from '@/hooks/contracts/ico/use-bonding-curve-contract';

interface BondingCurveChartD3Props {
  currentPrice?: bigint;
  tokensSold?: bigint;
}

// Generate bonding curve data based on the actual contract formula
const generateBondingCurveData = (
  currentTokensSold: number,
  currentPriceETH: number,
  bondingCurveSupply: number,
  basePrice: number,
  ethPriceUSD: number,
) => {
  const data = [];
  const steps = 100; // More data points for smoother curve
  // For testing: limit to 50,000 tokens max
  const testMaxRange = 50000;
  const maxRange = Math.min(testMaxRange, Math.max(currentTokensSold * 1.2, bondingCurveSupply));
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

    const priceUSD = priceETH * ethPriceUSD; // Use live ETH price

    data.push({
      tokensSold: Math.round(tokensSold),
      priceETH: priceETH,
      priceUSD: priceUSD,
      phase: tokensSold <= currentTokensSold ? 'completed' : 'upcoming',
      isFixedPrice: tokensSold >= bondingCurveSupply,
    });
  }

  return data;
};

export default function BondingCurveChartD3({
  currentPrice: propCurrentPrice,
  tokensSold: propTokensSold,
}: BondingCurveChartD3Props) {
  const { contractState, ethPrice } = useBondingCurveContracts();
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Generate bonding curve data
  const bondingCurveData = useMemo(() => {
    return generateBondingCurveData(
      currentTokensSold,
      currentPriceETH,
      bondingCurveSupply,
      basePrice,
      ethPrice?.current || 3000,
    );
  }, [currentTokensSold, currentPriceETH, bondingCurveSupply, basePrice, ethPrice?.current]);

  useEffect(() => {
    if (!svgRef.current || bondingCurveData.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions
    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create SVG container
    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(bondingCurveData, (d) => d.tokensSold) || 50000])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(bondingCurveData, (d) => d.priceUSD) || 0.005])
      .range([height, 0]);

    // Create line generator
    const line = d3
      .line<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y((d) => yScale(d.priceUSD))
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
          .tickValues(xScale.ticks(10)),
      );

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
          .tickValues(yScale.ticks(5)),
      );

    // Style grid lines
    g.selectAll('.grid line')
      .style('stroke', '#374151')
      .style('stroke-opacity', 0.3)
      .style('stroke-dasharray', '3,3');

    // Add X axis
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale).tickFormat((d: d3.NumberValue) => {
          const value = d.valueOf();
          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
          if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
          return value.toString();
        }),
      );

    xAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '10px');

    xAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add Y axis
    const yAxis = g
      .append('g')
      .call(d3.axisLeft(yScale).tickFormat((d: d3.NumberValue) => `$${d.valueOf().toFixed(6)}`));

    yAxis.selectAll('text').style('fill', '#9CA3AF').style('font-size', '10px');

    yAxis.selectAll('line, path').style('stroke', '#9CA3AF');

    // Add axis labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .style('text-anchor', 'middle')
      .style('fill', '#9CA3AF')
      .style('font-size', '12px')
      .text('Tokens Sold');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .style('text-anchor', 'middle')
      .style('fill', '#9CA3AF')
      .style('font-size', '12px')
      .text('Price (USD)');

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
      .y1((d) => yScale(d.priceUSD))
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

    // Add test limit line
    g.append('line')
      .attr('x1', xScale(50000))
      .attr('y1', 0)
      .attr('x2', xScale(50000))
      .attr('y2', height)
      .attr('stroke', '#FFA500')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    g.append('text')
      .attr('x', xScale(50000))
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('fill', '#FFA500')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .text('TEST LIMIT (50K)');

    // Add current position line and dot
    if (currentTokensSold > 0) {
      const currentX = xScale(currentTokensSold);
      const currentY = yScale(currentPriceETH * (ethPrice?.current || 0));

      // Current position line
      g.append('line')
        .attr('x1', currentX)
        .attr('y1', 0)
        .attr('x2', currentX)
        .attr('y2', height)
        .attr('stroke', '#D0B264')
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '5,5');

      // Current position label
      g.append('text')
        .attr('x', currentX)
        .attr('y', -15)
        .attr('text-anchor', 'middle')
        .style('fill', '#D0B264')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(`CURRENT (${currentTokensSold.toLocaleString()})`);

      // Current position dot
      g.append('circle')
        .attr('cx', currentX)
        .attr('cy', currentY)
        .attr('r', 8)
        .attr('fill', '#D0B264')
        .attr('stroke', '#fff')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 0 10px rgba(208, 178, 100, 0.8))');

      // Inner white dot
      g.append('circle')
        .attr('cx', currentX)
        .attr('cy', currentY)
        .attr('r', 4)
        .attr('fill', '#fff');
    }
  }, [bondingCurveData, currentTokensSold, currentPriceETH, ethPrice?.current]);

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
}
