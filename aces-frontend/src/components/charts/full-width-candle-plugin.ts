/**
 * Full-width candlestick custom series plugin for Lightweight Charts v5.
 * Ported from pumpbot/cockpit/static/chart.js.
 *
 * LWC's built-in CandlestickSeries draws bodies at ~80% of barSpacing,
 * leaving visible black gaps. This custom renderer fills 100% width.
 */

import type {
  ICustomSeriesPaneRenderer,
  ICustomSeriesPaneView,
  CustomSeriesOptions,
  CustomData,
  CustomSeriesPricePlotValues,
  PaneRendererCustomData,
  BitmapCoordinatesRenderingScope,
  Time,
} from "lightweight-charts";

// ── Data shape: standard OHLC fields on top of CustomData ──
export interface FullWidthCandleData extends CustomData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ── Options: up/down colors for body and wick ──
export interface FullWidthCandleOptions extends CustomSeriesOptions {
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
}

/**
 * Renderer: draws candle bodies at 100% of barSpacing with DPI-correct
 * floor/ceil rounding to eliminate inter-candle gaps.
 */
class FullWidthCandleRenderer implements ICustomSeriesPaneRenderer {
  private _data: PaneRendererCustomData<Time, FullWidthCandleData> | null =
    null;
  private _options: FullWidthCandleOptions | null = null;

  draw(target: any, priceConverter: any): void {
    target.useBitmapCoordinateSpace(
      (scope: BitmapCoordinatesRenderingScope) => {
        this._drawImpl(scope, priceConverter);
      },
    );
  }

  update(
    data: PaneRendererCustomData<Time, FullWidthCandleData>,
    options: FullWidthCandleOptions,
  ): void {
    this._data = data;
    this._options = options;
  }

  private _drawImpl(
    scope: BitmapCoordinatesRenderingScope,
    priceToCoordinate: (price: number) => number | null,
  ): void {
    if (
      !this._data ||
      !this._data.bars.length ||
      !this._data.visibleRange ||
      !this._options
    )
      return;

    const ctx = scope.context;
    const hpr = scope.horizontalPixelRatio;
    const vpr = scope.verticalPixelRatio;
    const bars = this._data.bars;
    const vr = this._data.visibleRange;
    const barSpacing = this._data.barSpacing;
    // Wick width: exactly 1 device pixel (crisp at any DPI)
    const wickW = Math.max(1, Math.round(hpr));

    for (let i = vr.from; i < vr.to; i++) {
      const bar = bars[i];
      const d = bar.originalData;
      const isUp = d.close >= d.open;

      // Convert OHLC prices to pixel coordinates
      const openY = priceToCoordinate(d.open);
      const highY = priceToCoordinate(d.high);
      const lowY = priceToCoordinate(d.low);
      const closeY = priceToCoordinate(d.close);
      if (
        openY === null ||
        highY === null ||
        lowY === null ||
        closeY === null
      )
        continue;

      // ── Wick: 1 device pixel centered on bar.x ──
      ctx.fillStyle = isUp
        ? this._options.wickUpColor
        : this._options.wickDownColor;
      const wickX = Math.round(bar.x * hpr - wickW / 2);
      const wickTop = Math.round(Math.min(highY, lowY) * vpr);
      const wickBot = Math.round(Math.max(highY, lowY) * vpr);
      ctx.fillRect(wickX, wickTop, wickW, Math.max(1, wickBot - wickTop));

      // ── Body: full barSpacing width ──
      // floor(left) + ceil(right) = zero gaps at any DPI (pumpbot technique)
      ctx.fillStyle = isUp ? this._options.upColor : this._options.downColor;
      const halfBar = (barSpacing * hpr) / 2;
      const bodyLeft = Math.floor(bar.x * hpr - halfBar);
      const bodyRight = Math.ceil(bar.x * hpr + halfBar);
      const bodyW = bodyRight - bodyLeft;
      const bodyTop = Math.round(Math.min(openY, closeY) * vpr);
      const bodyBot = Math.round(Math.max(openY, closeY) * vpr);
      // Minimum 3px body height (DexScreener aesthetic for tiny candles)
      const minBodyH = Math.max(3, Math.round(3 * vpr));
      const rawBodyH = bodyBot - bodyTop;
      const bodyH = Math.max(minBodyH, rawBodyH);
      // Center the min-height body around the midpoint when clamped
      const finalTop =
        rawBodyH < minBodyH
          ? Math.round((bodyTop + bodyBot) / 2 - bodyH / 2)
          : bodyTop;
      ctx.fillRect(bodyLeft, finalTop, bodyW, bodyH);
    }
  }
}

/**
 * Custom series definition that LWC v5 uses via chart.addCustomSeries().
 * Wires up the renderer, price builder, and default color options.
 */
export class FullWidthCandleSeries
  implements
    ICustomSeriesPaneView<Time, FullWidthCandleData, FullWidthCandleOptions>
{
  private _renderer = new FullWidthCandleRenderer();

  /** Tell LWC which price values to use for auto-scaling (high, low, close) */
  priceValueBuilder(plotRow: FullWidthCandleData): CustomSeriesPricePlotValues {
    return [plotRow.high, plotRow.low, plotRow.close];
  }

  renderer(): ICustomSeriesPaneRenderer {
    return this._renderer;
  }

  /** Whitespace detection: if close is missing, treat as gap */
  isWhitespace(data: FullWidthCandleData): boolean {
    return (data as any).close === undefined;
  }

  update(
    data: PaneRendererCustomData<Time, FullWidthCandleData>,
    options: FullWidthCandleOptions,
  ): void {
    this._renderer.update(data, options);
  }

  /** Default colors matching the ACES dark theme palette */
  defaultOptions(): FullWidthCandleOptions {
    return {
      upColor: "#184d37",
      downColor: "#8b2232",
      wickUpColor: "#22704e",
      wickDownColor: "#a62a3e",
    } as FullWidthCandleOptions;
  }
}
