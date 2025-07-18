'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import React from 'react';
import { formatEther } from 'viem';

interface BondingCurveChartProps {
  currentPrice?: bigint;
  tokensSold?: bigint;
}

const MAX_SUPPLY = 1000000;

// Generate bonding curve that approximates contract behavior
const generateActualBondingCurveData = (currentTokensSold: number, currentPrice: number) => {
  const data = [];
  const steps = 50; // More steps for smoother curve

  const maxRange = Math.max(currentTokensSold * 1.5, 500000, MAX_SUPPLY);
  const stepSize = maxRange / steps;

  for (let i = 0; i <= steps; i++) {
    const tokensSold = i * stepSize;

    // Approximate the contract's bonding curve behavior
    // Based on your chart: flat until ~200K, then steep curve
    let price: number;

    const flatThreshold = 200000; // Tokens where curve starts getting steep
    const basePrice = 0.00000006; // 60 nETH base

    if (tokensSold <= flatThreshold) {
      // Flat or minimal increase for first 200K tokens
      price = basePrice + (basePrice * 0.5 * tokensSold) / flatThreshold; // Gradual to ~90 nETH
    } else {
      // Steep bonding curve after threshold
      const excessTokens = tokensSold - flatThreshold;
      const maxExcess = MAX_SUPPLY - flatThreshold;
      const curveMultiplier = Math.pow(excessTokens / maxExcess, 2); // Quadratic curve
      price = basePrice * 1.5 + currentPrice * 4 * curveMultiplier; // Steep increase
    }

    data.push({
      tokensSold: Math.round(tokensSold),
      price: Math.max(price, basePrice),
      priceETH: Math.max(price, basePrice),
      progress: (tokensSold / MAX_SUPPLY) * 100,
      phase: tokensSold <= currentTokensSold ? 'completed' : 'upcoming',
    });
  }

  return data;
};

export default function BondingCurveChart({
  currentPrice = BigInt(0),
  tokensSold = BigInt(0),
}: BondingCurveChartProps) {
  const currentTokensSoldNumber = Number(formatEther(tokensSold));
  const currentPriceNumber = Number(formatEther(currentPrice));

  // Generate bonding curve data that respects actual contract pricing
  const bondingCurveData = generateActualBondingCurveData(
    currentTokensSoldNumber,
    currentPriceNumber,
  );

  // Use actual contract price
  const displayPrice = currentPriceNumber;

  // Ensure the chart accommodates the actual price
  const allPrices = [...bondingCurveData.map((d) => d.price)];
  if (displayPrice > 0) {
    allPrices.push(displayPrice);
  }

  const maxPriceInData = Math.max(...allPrices);

  // Set Y-axis domain with proper padding
  const yAxisMax = maxPriceInData * 1.2;
  const yAxisMin = 0;

  // Debug logging
  console.log('Fixed Chart Debug:', {
    currentPrice: currentPrice.toString(),
    currentPriceNumber,
    currentPriceInNanoETH: currentPriceNumber * 1e9,
    tokensSold: tokensSold.toString(),
    currentTokensSoldNumber,
    displayPrice,
    bondingCurveDataSample: bondingCurveData.slice(0, 3),
    yAxisMax,
    yAxisMin,
    maxPriceInData,
    chartWillShow: {
      dotX: currentTokensSoldNumber,
      dotY: displayPrice,
      dotVisible: displayPrice > 0 && currentTokensSoldNumber > 0,
    },
  });

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={bondingCurveData} margin={{ top: 25, right: 25, left: 10, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="tokensSold"
            stroke="#9CA3AF"
            fontSize={10}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
              return value.toString();
            }}
            label={{ value: 'Tokens Sold', position: 'bottom', offset: 0 }}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={10}
            axisLine={false}
            tickLine={false}
            domain={[yAxisMin, yAxisMax]}
            tickFormatter={(value) => `${(value * 1e9).toFixed(0)} nETH`}
            label={{ value: 'Price (nETH)', angle: -90, position: 'insideLeft', offset: 12 }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="url(#bondingGradient)"
            strokeWidth={2}
            fill="url(#bondingGradientFill)"
            fillOpacity={0.3}
          />

          {/* Reference line showing current position - only show if we have data */}
          {currentTokensSoldNumber > 0 && displayPrice > 0 && (
            <ReferenceLine
              x={currentTokensSoldNumber}
              stroke="#D0B264"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `CURRENT: ${(displayPrice * 1e9).toFixed(1)} nETH`,
                position: 'top',
                fill: '#D0B264',
                fontSize: 10,
                fontWeight: 'bold',
                offset: 10,
              }}
            />
          )}

          {/* Current position dot - ALWAYS show when we have valid contract data */}
          {currentTokensSoldNumber > 0 && displayPrice > 0 && (
            <>
              <ReferenceDot
                x={currentTokensSoldNumber}
                y={displayPrice}
                r={16}
                fill="#D0B264"
                stroke="#fff"
                strokeWidth={5}
                isFront={true}
                style={{
                  filter: 'drop-shadow(0 0 15px rgba(208, 178, 100, 1))',
                }}
              />
              {/* Additional inner dot for visibility */}
              <ReferenceDot
                x={currentTokensSoldNumber}
                y={displayPrice}
                r={8}
                fill="#FFF"
                stroke="none"
                isFront={true}
              />
            </>
          )}

          {/* Starting position dot when no sales yet */}
          {currentTokensSoldNumber === 0 && (
            <ReferenceDot
              x={0}
              y={bondingCurveData[0]?.price || 0.00000006}
              r={14}
              fill="#D0B264"
              stroke="#fff"
              strokeWidth={4}
              isFront={true}
              style={{
                filter: 'drop-shadow(0 0 10px rgba(208, 178, 100, 0.9))',
              }}
            />
          )}

          <defs>
            <linearGradient id="bondingGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#D0B264" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id="bondingGradientFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D0B264" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
