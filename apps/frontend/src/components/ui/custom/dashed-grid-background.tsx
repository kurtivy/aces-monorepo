"use client";

import React from "react";

type Props = {
  className?: string;
  bg?: string;
  lineColor?: string;
  // Variant: dense uses repeating gradients; sparse uses positioned SVG lines
  variant?: "dense" | "sparse";
  opacity?: number; // overlay fade 0–1 (applies to lines only)

  // Dense options
  gap?: number; // distance between grid lines
  dash?: number; // dash length
  thickness?: number; // line thickness

  // Sparse options (percent positions from the left/top)
  vPercentsLeft?: number[]; // e.g. [5, 12, 20]
  vPercentsRight?: number[]; // e.g. [80, 88, 95]
  hPercents?: number[]; // e.g. [12, 88]
  dashArray?: string; // e.g. "6 8"
  strokeWidth?: number; // px
};

export default function DashedGridBackground({
  className = "",
  bg = "#151c16",
  lineColor = "#D7BF75",
  variant = "sparse",
  opacity = 1,

  // dense defaults
  gap = 160,
  dash = 6,
  thickness = 1,

  // sparse defaults
  vPercentsLeft = [5, 12, 20],
  vPercentsRight = [80, 88, 95],
  hPercents = [12, 88],
  dashArray = "6 8",
  strokeWidth = 1,
}: Props) {
  if (variant === "dense") {
    const hPattern = `repeating-linear-gradient(0deg, ${lineColor}, ${lineColor} ${thickness}px, transparent ${thickness}px, transparent ${dash + thickness}px)`;
    const vPattern = `repeating-linear-gradient(90deg, ${lineColor}, ${lineColor} ${thickness}px, transparent ${thickness}px, transparent ${dash + thickness}px)`;
    return (
      <div
        className={className}
        style={{
          backgroundColor: bg,
          backgroundImage: `${hPattern}, ${vPattern}`,
          backgroundSize: `${gap}px ${gap}px, ${gap}px ${gap}px`,
          backgroundBlendMode: "normal",
          opacity,
        }}
      />
    );
  }

  // Sparse grid using SVG so we can position only a few lines
  return (
    <div
      className={className}
      style={{ backgroundColor: bg, position: "relative" }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}
      >
        {/* Horizontal Lines */}
        {hPercents.map((y, idx) => (
          <line
            key={`h-${idx}`}
            x1="0"
            y1={`${y}`}
            x2="100"
            y2={`${y}`}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            vectorEffect="non-scaling-stroke"
            shapeRendering="crispEdges"
          />
        ))}
        {/* Vertical Lines - left cluster */}
        {vPercentsLeft.map((x, idx) => (
          <line
            key={`vl-${idx}`}
            x1={`${x}`}
            y1="0"
            x2={`${x}`}
            y2="100"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            vectorEffect="non-scaling-stroke"
            shapeRendering="crispEdges"
          />
        ))}
        {/* Vertical Lines - right cluster */}
        {vPercentsRight.map((x, idx) => (
          <line
            key={`vr-${idx}`}
            x1={`${x}`}
            y1="0"
            x2={`${x}`}
            y2="100"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            vectorEffect="non-scaling-stroke"
            shapeRendering="crispEdges"
          />
        ))}
      </svg>
    </div>
  );
}
