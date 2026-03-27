import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from "lightweight-charts";
import type { OhlcvCandle } from "~/lib/gecko-terminal";

interface LightweightChartProps {
  candles: OhlcvCandle[];
}

export function LightweightChart({ candles }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(196,187,172,0.5)",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(208,178,132,0.05)" },
        horzLines: { color: "rgba(208,178,132,0.05)" },
      },
      crosshair: {
        vertLine: { color: "rgba(208,178,132,0.2)", labelBackgroundColor: "#1a1a18" },
        horzLine: { color: "rgba(208,178,132,0.2)", labelBackgroundColor: "#1a1a18" },
      },
      timeScale: {
        borderColor: "rgba(208,178,132,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(208,178,132,0.08)",
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#184d37",
      downColor: "#8b2232",
      borderUpColor: "#22704e",
      borderDownColor: "#a62a3e",
      wickUpColor: "#22704e",
      wickDownColor: "#a62a3e",
      priceFormat: {
        type: "price",
        precision: 10,
        minMove: 0.0000000001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series as typeof seriesRef.current;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || candles.length === 0) return;

    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as import("lightweight-charts").UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chartRef.current.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-full w-full" />;
}
