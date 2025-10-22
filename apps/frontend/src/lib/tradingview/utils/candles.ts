import { Bar } from '../../../../public/charting_library/charting_library';

const MAX_GAP_FILL_DURATION_MS = 48 * 60 * 60 * 1000;

export function normaliseTimestamp(rawTimestamp: number | string | null | undefined): number {
  const numeric =
    typeof rawTimestamp === 'string' ? parseFloat(rawTimestamp) : Number(rawTimestamp ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return NaN;
  }

  return numeric < 1e12 ? numeric * 1000 : numeric;
}

export function alignTimeToTimeframe(timestampMs: number, timeframeMs: number): number {
  if (!Number.isFinite(timestampMs)) {
    return timestampMs;
  }

  if (!Number.isFinite(timeframeMs) || timeframeMs <= 0) {
    return timestampMs;
  }

  return Math.floor(timestampMs / timeframeMs) * timeframeMs;
}

export function ensureValidOhlc(bar: Bar): Bar | null {
  const open = Number(bar.open);
  const high = Number(bar.high);
  const low = Number(bar.low);
  const close = Number(bar.close);

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return null;
  }

  let finalHigh = high;
  let finalLow = low;

  if (finalHigh <= 0 || !Number.isFinite(finalHigh)) {
    finalHigh = Math.max(open, close);
  }

  if (finalLow <= 0 || !Number.isFinite(finalLow)) {
    finalLow = Math.min(open, close);
  }

  if (finalHigh < finalLow) {
    [finalHigh, finalLow] = [finalLow, finalHigh];
  }

  const maxOpenClose = Math.max(open, close);
  if (finalHigh < maxOpenClose) {
    finalHigh = Math.max(finalHigh, maxOpenClose);
  }

  const minOpenClose = Math.min(open, close);
  if (finalLow > minOpenClose) {
    finalLow = Math.min(finalLow, minOpenClose);
  }

  if (open <= 0 && finalHigh <= 0 && finalLow <= 0 && close <= 0) {
    return null;
  }

  return {
    ...bar,
    open,
    high: finalHigh,
    low: finalLow,
    close,
    volume: Number.isFinite(bar.volume) ? Number(bar.volume) : 0,
  };
}

export function fillMissingBars(
  bars: Bar[],
  timeframeMs: number,
  maxGapMs: number = MAX_GAP_FILL_DURATION_MS,
): Bar[] {
  if (!Array.isArray(bars) || bars.length === 0) {
    return [];
  }

  const filled: Bar[] = [];
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  filled.push(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    const gap = current.time - prev.time;

    if (
      Number.isFinite(timeframeMs) &&
      timeframeMs > 0 &&
      gap > timeframeMs &&
      gap <= maxGapMs
    ) {
      const missing = Math.floor(gap / timeframeMs) - 1;
      for (let j = 1; j <= missing; j++) {
        const syntheticTime = prev.time + j * timeframeMs;
        filled.push({
          time: syntheticTime,
          open: prev.close,
          high: prev.close,
          low: prev.close,
          close: prev.close,
          volume: 0,
        });
      }
    }

    filled.push(current);
  }

  return filled;
}

export function bridgeBar(previousBar: Bar | null, currentBar: Bar): Bar {
  if (!currentBar) {
    return currentBar;
  }

  if (!previousBar || previousBar.time === currentBar.time) {
    return { ...currentBar };
  }

  const bridged: Bar = { ...currentBar };
  const prevClose = previousBar.close;

  if (!Number.isFinite(prevClose) || prevClose <= 0) {
    return bridged;
  }

  bridged.open = prevClose;
  bridged.high = Math.max(bridged.high, prevClose, bridged.open, bridged.close);
  bridged.low = Math.min(bridged.low, prevClose, bridged.open, bridged.close);

  if (bridged.high < bridged.low) {
    [bridged.high, bridged.low] = [bridged.low, bridged.high];
  }

  if (bridged.high < Math.max(bridged.open, bridged.close)) {
    bridged.high = Math.max(bridged.high, bridged.open, bridged.close);
  }

  if (bridged.low > Math.min(bridged.open, bridged.close)) {
    bridged.low = Math.min(bridged.low, bridged.open, bridged.close);
  }

  return bridged;
}

export function cloneBar(bar: Bar | null): Bar | null {
  if (!bar) {
    return null;
  }

  return { ...bar };
}
