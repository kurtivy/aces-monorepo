import { useEffect, useRef } from "react";
import { createChart, type IChartApi } from "lightweight-charts";
import {
  FullWidthCandleSeries,
  type FullWidthCandleData,
} from "~/components/charts/full-width-candle-plugin";
import type { OhlcvCandle } from "~/lib/gecko-terminal";

interface LightweightChartProps {
  candles: OhlcvCandle[];
}

/**
 * Chart component using the full-width custom candlestick renderer.
 * Replaces the built-in CandlestickSeries to eliminate inter-candle gaps.
 */
export function LightweightChart({ candles }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addCustomSeries"]> | null>(
    null,
  );

  // Create chart + custom series on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(196,187,172,0.5)",
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "rgba(208,178,132,0.05)" },
        horzLines: { color: "rgba(208,178,132,0.05)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(208,178,132,0.2)",
          labelBackgroundColor: "#1a1a18",
        },
        horzLine: {
          color: "rgba(208,178,132,0.2)",
          labelBackgroundColor: "#1a1a18",
        },
      },
      timeScale: {
        borderColor: "rgba(208,178,132,0.08)",
        timeVisible: true,
        secondsVisible: false,
        // Tighter bar spacing for dense candle look
        barSpacing: 8,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: "rgba(208,178,132,0.08)",
        autoScale: true,
      },
    });

    // Use the full-width custom renderer instead of built-in CandlestickSeries
    const series = chart.addCustomSeries(new FullWidthCandleSeries(), {
      upColor: "#184d37",
      downColor: "#8b2232",
      wickUpColor: "#22704e",
      wickDownColor: "#a62a3e",
      priceFormat: {
        type: "price",
        precision: 10,
        minMove: 0.0000000001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || candles.length === 0) return;

    // Map OhlcvCandle to FullWidthCandleData (adds UTCTimestamp cast)
    const data: FullWidthCandleData[] = candles.map((c) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(data);
    chartRef.current.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-full w-full" />;
}
