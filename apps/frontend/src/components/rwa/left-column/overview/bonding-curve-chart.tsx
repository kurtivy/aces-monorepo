"use client"

import { useRef, useEffect, useMemo, useState } from "react"
import * as d3 from "d3"

interface BondingCurveChartProps {
  currentPrice?: number
  tokensSold?: number
}

interface TooltipData {
  tokensSold: number
  priceETH: number
  priceUSD: number
  x: number
  y: number
}

// Generate bonding curve data based on a simplified formula
const generateBondingCurveData = (
  currentTokensSold: number,
  currentPriceETH: number,
  bondingCurveSupply: number,
  basePrice: number,
) => {
  const data = []
  const steps = 100
  const maxRange = bondingCurveSupply
  const stepSize = maxRange / steps

  for (let i = 0; i <= steps; i++) {
    const tokensSold = i * stepSize

    let priceETH: number

    if (tokensSold >= bondingCurveSupply) {
      priceETH = basePrice * 2
    } else {
      const progress = tokensSold / bondingCurveSupply
      const multiplier = 1 + progress
      priceETH = basePrice * multiplier * multiplier
    }

    data.push({
      tokensSold: Math.round(tokensSold),
      priceETH: priceETH,
      phase: tokensSold <= currentTokensSold ? "completed" : "upcoming",
      isFixedPrice: tokensSold >= bondingCurveSupply,
    })
  }

  return data
}

const calculatePriceAtTokens = (tokensSold: number, bondingCurveSupply: number, basePrice: number): number => {
  if (tokensSold >= bondingCurveSupply) {
    return basePrice * 2
  }

  const progress = tokensSold / bondingCurveSupply
  const multiplier = 1 + progress
  return basePrice * multiplier * multiplier
}

export default function BondingCurveChart({
  currentPrice: propCurrentPrice,
  tokensSold: propTokensSold,
}: BondingCurveChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null)

  // Mock data for demonstration
  const currentTokensSold = propTokensSold || 372000
  const currentPriceETH = propCurrentPrice || 0.000268
  const bondingCurveSupply = 1000000
  const basePrice = 0.0001
  const ethPrice = 3000 // Mock ETH price

  const bondingCurveData = useMemo(() => {
    return generateBondingCurveData(currentTokensSold, currentPriceETH, bondingCurveSupply, basePrice)
  }, [currentTokensSold, currentPriceETH, bondingCurveSupply, basePrice])

  useEffect(() => {
    if (!svgRef.current || bondingCurveData.length === 0) return

    d3.select(svgRef.current).selectAll("*").remove()

    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const width = 280 - margin.left - margin.right
    const height = 200 - margin.top - margin.bottom

    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    const xScale = d3.scaleLinear().domain([0, bondingCurveSupply]).range([0, width])
    const maxETHPrice = d3.max(bondingCurveData, (d) => d.priceETH) || 0.0004
    const yScale = d3.scaleLinear().domain([0, maxETHPrice]).range([height, 0])

    const line = d3
      .line<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y((d) => yScale(d.priceETH))
      .curve(d3.curveMonotoneX)

    // Add grid
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-height)
          .tickFormat(() => "")
          .tickValues([0, 250000, 500000, 750000, 1000000]),
      )

    g.selectAll(".grid line").style("stroke", "#374151").style("stroke-opacity", 0.3).style("stroke-dasharray", "2,2")

    // Add axes
    const xAxis = g
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, 250000, 500000, 750000, 1000000])
          .tickFormat((d: d3.NumberValue) => {
            const value = d.valueOf()
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
            return value.toString()
          }),
      )

    xAxis.selectAll("text").style("fill", "#9CA3AF").style("font-size", "8px")
    xAxis.selectAll("line, path").style("stroke", "#9CA3AF")

    const yAxis = g.append("g").call(
      d3
        .axisLeft(yScale)
        .tickValues([0, maxETHPrice])
        .tickFormat((d: d3.NumberValue) => {
          const value = d.valueOf()
          if (value === 0) return "0"
          return `${value.toFixed(6)}`
        }),
    )

    yAxis.selectAll("text").style("fill", "#9CA3AF").style("font-size", "8px")
    yAxis.selectAll("line, path").style("stroke", "#9CA3AF")

    // Create gradient
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "areaGradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", height)

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#D0B284").attr("stop-opacity", 0.4)

    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#D0B284").attr("stop-opacity", 0.1)

    // Add area
    const area = d3
      .area<(typeof bondingCurveData)[0]>()
      .x((d) => xScale(d.tokensSold))
      .y0(height)
      .y1((d) => yScale(d.priceETH))
      .curve(d3.curveMonotoneX)

    g.append("path").datum(bondingCurveData).attr("fill", "url(#areaGradient)").attr("d", area)

    // Add line
    g.append("path")
      .datum(bondingCurveData)
      .attr("fill", "none")
      .attr("stroke", "#D0B284")
      .attr("stroke-width", 2)
      .attr("d", line)

    // Add current position
    if (currentTokensSold > 0) {
      const currentX = xScale(currentTokensSold)
      const currentY = yScale(currentPriceETH)

      g.append("line")
        .attr("x1", currentX)
        .attr("y1", 0)
        .attr("x2", currentX)
        .attr("y2", height)
        .attr("stroke", "#D0B284")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")

      g.append("circle")
        .attr("cx", currentX)
        .attr("cy", currentY)
        .attr("r", 4)
        .attr("fill", "#D0B284")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
    }

    // Interactive overlay
    const crosshairGroup = g.append("g").attr("class", "crosshairs").style("display", "none")

    const verticalLine = crosshairGroup
      .append("line")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.8)

    const horizontalLine = crosshairGroup
      .append("line")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.8)

    const intersectionDot = crosshairGroup
      .append("circle")
      .attr("r", 3)
      .attr("fill", "#FFFFFF")
      .attr("stroke", "#D0B284")
      .attr("stroke-width", 1)

    const mouseOverlay = g
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")

    mouseOverlay
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event, this)

        if (mouseX < 0 || mouseX > width) {
          crosshairGroup.style("display", "none")
          setTooltipData(null)
          return
        }

        const tokensAtX = xScale.invert(mouseX)

        if (tokensAtX < 0 || tokensAtX > bondingCurveSupply) {
          crosshairGroup.style("display", "none")
          setTooltipData(null)
          return
        }

        const priceETH = calculatePriceAtTokens(tokensAtX, bondingCurveSupply, basePrice)
        const priceUSD = priceETH * ethPrice

        const chartX = xScale(tokensAtX)
        const chartY = yScale(priceETH)

        verticalLine.attr("x1", chartX).attr("x2", chartX).attr("y1", 0).attr("y2", height)
        horizontalLine.attr("x1", 0).attr("x2", width).attr("y1", chartY).attr("y2", chartY)
        intersectionDot.attr("cx", chartX).attr("cy", chartY)

        crosshairGroup.style("display", null)

        const containerRect = svgRef.current?.getBoundingClientRect()
        if (containerRect) {
          setTooltipData({
            tokensSold: tokensAtX,
            priceETH,
            priceUSD,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
          })
        }
      })
      .on("mouseleave", () => {
        crosshairGroup.style("display", "none")
        setTooltipData(null)
      })
  }, [bondingCurveData, currentTokensSold, currentPriceETH, bondingCurveSupply, basePrice])

  return (
    <div className="w-full h-full bg-transparent flex items-center justify-center relative">
      <svg ref={svgRef} style={{ width: "100%", height: "100%", maxWidth: "280px", maxHeight: "200px" }}></svg>

      {tooltipData && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: tooltipData.x + 10,
            top: tooltipData.y - 60,
            transform: tooltipData.x > 200 ? "translateX(-100%)" : "none",
          }}
        >
          <div className="bg-[#231F20] border border-[#D0B284] rounded-lg p-2 shadow-xl">
            <div className="text-xs space-y-1">
              <div className="text-[#FFFFFF] font-semibold">
                {tooltipData.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
              </div>
              <div className="text-[#DCDDCC]">ETH: {tooltipData.priceETH.toFixed(8)}</div>
              <div className="text-[#D7BF75]">USD: ${tooltipData.priceUSD.toFixed(4)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
