/**
 * Real-Time Candle Builder
 *
 * Constructs OHLCV candles from streaming trade data in real-time.
 * This allows TradingView charts to update instantly as trades happen,
 * without polling the REST API.
 */

export interface Trade {
  timestamp: number; // milliseconds
  price: number;
  volume: number;
  isBuy: boolean;
}

export interface Candle {
  time: number; // milliseconds
  open: number;
  high: number;
  low: number;
  close: number; // VWAP close price
  volume: number;
  // 🔥 NEW: Trade buffering for VWAP and chronological sorting
  trades: Trade[]; // Store all trades for this candle
  totalValue: number; // Σ(price × volume) for VWAP calculation
  isFinalized: boolean; // Whether candle is "closed" (no more late trades expected)
  lastUpdateTime: number; // 🔥 NEW: When this candle was last updated (for emission buffering)
}

export type CandleUpdateCallback = (candle: Candle) => void;

export class RealtimeCandleBuilder {
  private currentCandles = new Map<string, Candle>(); // key = timeframe
  private callbacks = new Map<string, CandleUpdateCallback[]>();
  private lastClosePrices = new Map<string, number>(); // key = timeframe, value = last candle close price
  // 🔥 NEW: Time-driven emission - timers for each active timeframe
  private timeframeTimers = new Map<string, ReturnType<typeof setInterval>>();
  // Track which candles are synthetic (no real trades yet)
  private syntheticCandles = new Set<string>(); // key = timeframe:candleTime
  // 🔥 NEW: Track most recent candle time sent to avoid time violations
  private mostRecentCandleTimeSent = new Map<string, number>(); // key = timeframe, value = candleTime
  // 🔥 NEW: Emission buffer timer - checks for candles ready to emit
  private emissionTimer: ReturnType<typeof setInterval> | null = null;
  // 🔥 PHASE 1: Dual-speed emission delays (TradingView optimized)
  private readonly CURRENT_BUCKET_DELAY_MS = 50; // Current active candle: 50ms (professional trader feel)
  private readonly PREVIOUS_BUCKET_DELAY_MS = 1000; // Previous buckets: 1s grace period only
  private readonly FINALIZATION_CUTOFF_MS = 2000; // Don't update bars older than 2s (prevent visual glitches)
  // 🔥 PHASE 3: Track emission to prevent double-emission
  private lastEmissionTime = new Map<string, number>(); // key = "timeframe:candleTime"
  private readonly MIN_EMISSION_INTERVAL_MS = 100; // Throttle to 10 updates/sec max

  constructor(private debug = false) {
    // Start the emission buffer timer
    this.startEmissionTimer();
  }

  /**
   * Subscribe to candle updates for a specific timeframe
   */
  subscribe(timeframe: string, callback: CandleUpdateCallback): () => void {
    const callbacks = this.callbacks.get(timeframe) || [];
    const isFirstSubscriber = callbacks.length === 0;

    callbacks.push(callback);
    this.callbacks.set(timeframe, callbacks);

    if (this.debug) {
      console.log(
        `[CandleBuilder] Subscribed to ${timeframe} candles (total: ${callbacks.length})`,
      );
    }

    // 🔥 NEW: Start time-driven emission timer for this timeframe if it's the first subscriber
    if (isFirstSubscriber) {
      this.startTimeframeTimer(timeframe);
    }

    // Return unsubscribe function
    return () => {
      const cbs = this.callbacks.get(timeframe) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
      }
      if (cbs.length === 0) {
        this.callbacks.delete(timeframe);
        // 🔥 NEW: Stop timer when last subscriber unsubscribes
        this.stopTimeframeTimer(timeframe);
      }
    };
  }

  /**
   * Process incoming trade and update relevant candles
   */
  processTrade(trade: Trade): void {
    const now = Date.now();
    const tradeAgeMs = now - trade.timestamp;

    console.log('[CandleBuilder] 🔥 PROCESSING TRADE:', {
      price: trade.price.toFixed(8),
      volume: trade.volume.toFixed(4),
      timestamp: trade.timestamp,
      timestampISO: new Date(trade.timestamp).toISOString(),
      currentTime: now,
      currentTimeISO: new Date(now).toISOString(),
      tradeAgeMs: tradeAgeMs,
      tradeAgeSeconds: Math.round(tradeAgeMs / 1000),
      isBuy: trade.isBuy,
      activeTimeframes: Array.from(this.callbacks.keys()),
      // 🔥 DEBUG: Show mostRecentSent for each timeframe
      mostRecentSentByTimeframe: Array.from(this.callbacks.keys()).map((tf) => ({
        timeframe: tf,
        mostRecentSent: this.mostRecentCandleTimeSent.get(tf) || 0,
        mostRecentSentISO:
          (this.mostRecentCandleTimeSent.get(tf) || 0) > 0
            ? new Date(this.mostRecentCandleTimeSent.get(tf)!).toISOString()
            : 'NEVER_SET',
      })),
    });

    // Update all active timeframes
    for (const timeframe of this.callbacks.keys()) {
      try {
        this.updateCandle(timeframe, trade);
      } catch (error) {
        console.error(`[CandleBuilder] ❌ Error updating ${timeframe}:`, error);
      }
    }
  }

  /**
   * 🔥 PHASE 2: Emit current bucket candles immediately (with throttling)
   * Skips if not current bucket or if recently emitted
   */
  private emitCandleIfReady(timeframe: string, candle: Candle): void {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(timeframe);
    const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;
    const isCurrentBucket = candle.time === currentBucketTime;
    const mostRecentSent = this.mostRecentCandleTimeSent.get(timeframe) || 0;

    // 🔥 DEBUG: Log all critical values for diagnosis
    console.log('[CandleBuilder] 🔍 emitCandleIfReady CHECK:', {
      timeframe,
      candleTime: candle.time,
      candleTimeISO: new Date(candle.time).toISOString(),
      currentTime: now,
      currentTimeISO: new Date(now).toISOString(),
      currentBucketTime: currentBucketTime,
      currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
      isCurrentBucket,
      mostRecentSent: mostRecentSent,
      mostRecentSentISO: mostRecentSent > 0 ? new Date(mostRecentSent).toISOString() : 'NEVER_SET',
      timeDifference: candle.time - mostRecentSent,
      candleAgeMs: now - candle.time,
      intervalMs,
    });

    // Only emit current bucket immediately
    if (!isCurrentBucket) {
      console.warn('[CandleBuilder] ⏭️ Skipping immediate emission (not current bucket):', {
        timeframe,
        candleTime: new Date(candle.time).toISOString(),
        currentBucketTime: new Date(currentBucketTime).toISOString(),
        timeDifferenceMs: currentBucketTime - candle.time,
        isPastBucket: candle.time < currentBucketTime,
        isFutureBucket: candle.time > currentBucketTime,
      });
      return;
    }

    console.log('[CandleBuilder] ✅ PASSED current bucket check for', timeframe);

    // 🔥 PHASE 3: Throttle to prevent spamming
    const key = `${timeframe}:${candle.time}`;
    const lastEmit = this.lastEmissionTime.get(key) || 0;
    const timeSinceLastEmit = now - lastEmit;

    if (timeSinceLastEmit < this.MIN_EMISSION_INTERVAL_MS) {
      console.warn('[CandleBuilder] 🚦 Throttling immediate emission:', {
        timeframe,
        candleTime: new Date(candle.time).toISOString(),
        timeSinceLastEmit,
        throttleMs: this.MIN_EMISSION_INTERVAL_MS,
        lastEmitTime: lastEmit > 0 ? new Date(lastEmit).toISOString() : 'NEVER',
      });
      return; // Skip - throttled
    }

    console.log('[CandleBuilder] ✅ PASSED throttling check for', timeframe);

    // 🔥 DEBUG: Log values BEFORE time violation check
    console.log('[CandleBuilder] 🔍 TIME VIOLATION CHECK:', {
      timeframe,
      candleTime: candle.time,
      candleTimeISO: new Date(candle.time).toISOString(),
      mostRecentSent: mostRecentSent,
      mostRecentSentISO: mostRecentSent > 0 ? new Date(mostRecentSent).toISOString() : 'NEVER_SET',
      comparison: candle.time < mostRecentSent ? 'CANDLE IS OLDER' : 'CANDLE IS NEWER OR EQUAL',
      timeDifferenceMs: candle.time - mostRecentSent,
      willPass: candle.time >= mostRecentSent,
      isCurrentBucket,
      currentBucketTime: currentBucketTime,
    });

    // 🔥 CRITICAL FIX: Allow current bucket candles even if mostRecentSent is newer
    // This handles cases where trades arrive out of order or a future candle was emitted first
    // Only block candles that are OLDER than mostRecentSent AND not in the current bucket
    const isInCurrentOrPreviousBucket = candle.time >= currentBucketTime - intervalMs;
    const shouldBlock = candle.time < mostRecentSent && !isInCurrentOrPreviousBucket;

    if (shouldBlock) {
      const timeDiffMs = candle.time - mostRecentSent;
      const timeDiffSeconds = Math.round(timeDiffMs / 1000);

      console.error('🚨 [CandleBuilder] ⏮️ TIME VIOLATION - Immediate emission BLOCKED:', {
        timeframe,
        reason: 'CANDLE TIME IS OLDER THAN mostRecentSent AND NOT IN CURRENT/PREVIOUS BUCKET',
        candleTime: candle.time,
        candleTimeISO: new Date(candle.time).toISOString(),
        mostRecentSent: mostRecentSent,
        mostRecentSentISO: new Date(mostRecentSent).toISOString(),
        timeDifferenceMs: timeDiffMs,
        timeDifferenceSeconds: timeDiffSeconds,
        timeDifferenceMinutes: Math.round(timeDiffSeconds / 60),
        candleAgeMs: now - candle.time,
        mostRecentSentAgeMs: now - mostRecentSent,
        currentBucketTime: currentBucketTime,
        currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
        isCurrentBucket,
        isInCurrentOrPreviousBucket,
        // 🔥 CRITICAL: Show what set mostRecentSent
        emissionHistory:
          'Look for "📝 UPDATING mostRecentCandleTimeSent" logs above to see when it was set',
      });

      // 🔥 ADDITIONAL VISIBLE ERROR
      console.error(
        `🚨 [CandleBuilder] BLOCKED ${timeframe} candle: ${new Date(candle.time).toISOString()} is ${Math.abs(timeDiffSeconds)}s ${timeDiffMs < 0 ? 'OLDER' : 'NEWER'} than mostRecentSent ${new Date(mostRecentSent).toISOString()}`,
      );

      return;
    }

    // 🔥 DEBUG: Log if we're allowing emission despite mostRecentSent being newer
    if (candle.time < mostRecentSent && isInCurrentOrPreviousBucket) {
      console.log(
        `[CandleBuilder] ✅ ALLOWING emission despite mostRecentSent being newer (current/previous bucket):`,
        {
          timeframe,
          candleTime: new Date(candle.time).toISOString(),
          mostRecentSent: new Date(mostRecentSent).toISOString(),
          currentBucketTime: new Date(currentBucketTime).toISOString(),
          reason: 'CANDLE IS IN CURRENT OR PREVIOUS BUCKET - allowing out-of-order updates',
        },
      );
    }

    console.log('[CandleBuilder] ✅ PASSED time violation check for', timeframe);

    // Update tracking
    const previousMostRecentSent = this.mostRecentCandleTimeSent.get(timeframe) || 0;
    this.mostRecentCandleTimeSent.set(timeframe, candle.time);
    this.lastEmissionTime.set(key, now);

    // 🔥 DEBUG: Log when mostRecentSent is updated
    console.log('[CandleBuilder] 📝 UPDATING mostRecentCandleTimeSent:', {
      timeframe,
      previousValue: previousMostRecentSent,
      previousValueISO:
        previousMostRecentSent > 0 ? new Date(previousMostRecentSent).toISOString() : 'NEVER_SET',
      newValue: candle.time,
      newValueISO: new Date(candle.time).toISOString(),
      changeMs: candle.time - previousMostRecentSent,
    });

    // Emit to subscribers
    const callbacks = this.callbacks.get(timeframe) || [];

    console.log('[CandleBuilder] 📋 About to emit - callbacks count:', {
      timeframe,
      callbackCount: callbacks.length,
      hasCallbacks: callbacks.length > 0,
    });

    if (callbacks.length === 0) {
      console.error(
        '[CandleBuilder] ❌ NO CALLBACKS REGISTERED for',
        timeframe,
        '- candle will not be delivered!',
      );
      return; // No point emitting if no one is listening
    }

    if (this.debug) {
      console.log('[CandleBuilder] 🚀 IMMEDIATE emission (trade-triggered):', {
        timeframe,
        candleTime: new Date(candle.time).toISOString(),
        isCurrentBucket: true,
        timeSinceLastEmit,
        close: candle.close,
        volume: candle.volume,
        trades: candle.trades.length,
      });
    }

    console.log('[CandleBuilder] 🚀 Emitting candle to', callbacks.length, 'subscribers:', {
      timeframe,
      candleTime: new Date(candle.time).toISOString(),
      open: candle.open.toFixed(8),
      high: candle.high.toFixed(8),
      low: candle.low.toFixed(8),
      close: candle.close.toFixed(8),
      volume: candle.volume.toFixed(4),
      trades: candle.trades.length,
    });

    for (let i = 0; i < callbacks.length; i++) {
      const callback = callbacks[i];
      try {
        console.log(
          `[CandleBuilder] 🔔 Calling callback ${i + 1}/${callbacks.length} for ${timeframe}`,
        );
        callback({ ...candle });
        console.log(`[CandleBuilder] ✅ Callback ${i + 1} executed successfully for ${timeframe}`);
      } catch (error) {
        console.error(`[CandleBuilder] ❌ Error in callback ${i + 1} for ${timeframe}:`, error);
        console.error('[CandleBuilder] Error details:', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : 'No stack',
          timeframe,
          candleTime: candle.time,
        });
      }
    }

    console.log(
      `[CandleBuilder] ✅ Finished emitting ${timeframe} candle to ${callbacks.length} callbacks`,
    );
  }

  /**
   * Update a specific candle with new trade data
   *
   * 🔥 TradingView Optimization: Finalize bars after FINALIZATION_CUTOFF_MS
   * This prevents visual glitches where closed bars suddenly change
   */
  private updateCandle(timeframe: string, trade: Trade): void {
    const now = Date.now(); // Single declaration for reuse
    const intervalMs = this.getIntervalMs(timeframe);

    // 🔥 ROUNDING LOGIC EXPLANATION:
    // Math.floor(trade.timestamp / intervalMs) * intervalMs
    //
    // Example for 5m timeframe (300000ms):
    // - Trade at 01:40:25.500 (1763257225500ms)
    // - 1763257225500 / 300000 = 5877524.0833...
    // - Math.floor(5877524.0833) = 5877524
    // - 5877524 * 300000 = 1763257200000ms = 01:40:00.000 ✅
    //
    // - Trade at 01:45:00.000 (1763257500000ms)
    // - 1763257500000 / 300000 = 5877525.0
    // - Math.floor(5877525.0) = 5877525
    // - 5877525 * 300000 = 1763257500000ms = 01:45:00.000 ✅
    //
    // This rounds DOWN to the start of the time bucket
    const candleTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;

    // 🔥 NEW: Reject trades for bars that are too old (finalized)
    const candleAge = now - candleTime;
    const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;
    const isCurrentBucket = candleTime === currentBucketTime;
    const isPreviousBucket = candleTime === currentBucketTime - intervalMs;

    // 🔥 CRITICAL FIX: Allow updates to previous bucket within a grace period
    // This handles late-arriving trades that are still valid for the previous bucket
    // Only reject if candle is MORE than 1 interval old AND beyond finalization cutoff
    const isVeryOldBucket = candleTime < currentBucketTime - intervalMs;
    const shouldFinalize = isVeryOldBucket && candleAge > this.FINALIZATION_CUTOFF_MS;

    if (shouldFinalize) {
      console.warn('[CandleBuilder] 🚫 Rejecting late trade for finalized bar:', {
        timeframe,
        candleTime: new Date(candleTime).toISOString(),
        tradeTime: new Date(trade.timestamp).toISOString(),
        candleAge: Math.round(candleAge / 1000) + 's',
        cutoff: Math.round(this.FINALIZATION_CUTOFF_MS / 1000) + 's',
        isCurrentBucket,
        isPreviousBucket,
        isVeryOldBucket,
        currentBucketTime: new Date(currentBucketTime).toISOString(),
        reason:
          'CANDLE IS FINALIZED - Bar is closed (more than 1 interval old), no more updates allowed',
      });
      return; // Don't update finalized bars - prevents visual glitches
    }

    // 🔥 DEBUG: Log candle time calculation for diagnostics
    if (this.debug) {
      console.log(`[CandleBuilder] 📊 Candle calculation for ${timeframe}:`, {
        tradeTime: new Date(trade.timestamp).toISOString(),
        intervalMs,
        candleTime: new Date(candleTime).toISOString(),
        candleTimeMs: candleTime,
      });
    }

    // 🔥 CRITICAL FIX: Prevent time violations by ignoring very old trades
    // Find the most recent candle time for this timeframe
    const prefix = `${timeframe}:`;
    let mostRecentCandleTime = 0;
    for (const key of this.currentCandles.keys()) {
      if (key.startsWith(prefix)) {
        const time = parseInt(key.split(':')[1]);
        if (time > mostRecentCandleTime) {
          mostRecentCandleTime = time;
        }
      }
    }

    // Reject trades older than 15 minutes to prevent cascading stale data
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    const tradeAgeMs = now - trade.timestamp;
    const tradeAgeMinutes = Math.round(tradeAgeMs / (60 * 1000));

    if (trade.timestamp < fifteenMinutesAgo) {
      console.error(
        `🚨 [CandleBuilder] ⚠️ REJECTED OLD ${timeframe} TRADE - Too old for candle building:`,
        {
          timeframe,
          tradeTimestamp: trade.timestamp,
          tradeTimestampISO: new Date(trade.timestamp).toISOString(),
          currentTime: now,
          currentTimeISO: new Date(now).toISOString(),
          tradeAgeMs: tradeAgeMs,
          tradeAgeMinutes: tradeAgeMinutes,
          tradeAgeHours: Math.round(tradeAgeMinutes / 60),
          tradeAgeDays: Math.round(tradeAgeMinutes / (60 * 24)),
          cutoffMinutes: 15,
          reason: 'TRADE IS TOO OLD (>15 minutes) - Will not create/update candles',
          note: 'This trade will appear in trade history but NOT on the chart',
        },
      );
      return;
    }

    // Also prevent trades far in the future (safeguard against bad data)
    if (trade.timestamp > now + 60000) {
      // 1 minute in the future
      console.warn(
        `[CandleBuilder] ⚠️ Skipped future ${timeframe} trade (trade: ${new Date(trade.timestamp).toISOString()}, now: ${new Date(now).toISOString()})`,
      );
      return;
    }

    // 🔥 REMOVED: The "1 interval latency" check was too aggressive
    // With 5s emission buffer + Bitquery delays, trades can legitimately be 2+ intervals old
    // The emission buffer's time violation check handles this properly

    const key = `${timeframe}:${candleTime}`;
    let candle = this.currentCandles.get(key);
    const isSynthetic = this.syntheticCandles.has(key);
    const isFutureBucket = candleTime > currentBucketTime;

    // 🔥 DEBUG: Log rounding calculation to understand how candle time is determined
    const timeUntilNextBucket = intervalMs - ((now - currentBucketTime) % intervalMs);
    const secondsUntilNextBucket = Math.round(timeUntilNextBucket / 1000);
    const tradeTimeVsNow = trade.timestamp - now;

    const roundingCalculation = {
      tradeTimestamp: trade.timestamp,
      tradeTimestampISO: new Date(trade.timestamp).toISOString(),
      currentTime: now,
      currentTimeISO: new Date(now).toISOString(),
      tradeTimeVsNowMs: tradeTimeVsNow,
      tradeTimeVsNowSeconds: Math.round(tradeTimeVsNow / 1000),
      isTradeInFuture: tradeTimeVsNow > 0,
      intervalMs,
      division: trade.timestamp / intervalMs,
      floored: Math.floor(trade.timestamp / intervalMs),
      calculatedCandleTime: candleTime,
      calculatedCandleTimeISO: new Date(candleTime).toISOString(),
      currentBucketTime: currentBucketTime,
      currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
      timeUntilNextBucketMs: timeUntilNextBucket,
      secondsUntilNextBucket: secondsUntilNextBucket,
      isFutureBucket,
      timeDifferenceMs: candleTime - currentBucketTime,
      timeDifferenceSeconds: Math.round((candleTime - currentBucketTime) / 1000),
      // 🔥 CRITICAL: Check if this is happening at bucket boundary
      isNearBucketBoundary: timeUntilNextBucket < 5000, // Within 5 seconds of next bucket
      bucketBoundaryTime: new Date(currentBucketTime + intervalMs).toISOString(),
    };

    // Only log if it's a future bucket or near bucket boundary (to reduce noise)
    if (isFutureBucket || roundingCalculation.isNearBucketBoundary) {
      console.log(`[CandleBuilder] 🔢 ROUNDING CALCULATION for ${timeframe}:`, roundingCalculation);
    }

    // 🔥 NOTE: We allow creating future candles (they'll be stored but not emitted until current)
    // This handles cases where trades arrive slightly ahead of time due to clock skew or network delays
    // The emission logic will prevent sending them to TradingView until they're the current bucket
    if (isFutureBucket) {
      // 🔥 DIAGNOSTIC: Determine WHY this is happening
      let rootCause = 'UNKNOWN';
      if (tradeTimeVsNow > 0) {
        rootCause = `TRADE TIMESTAMP IS ${Math.round(tradeTimeVsNow / 1000)}s IN FUTURE (clock skew or backend timestamp issue)`;
      } else if (roundingCalculation.isNearBucketBoundary) {
        rootCause = `BUCKET ROLLOVER - Trade arrived ${secondsUntilNextBucket}s before next bucket, timestamp rounds to next bucket`;
      } else {
        rootCause = `TIMESTAMP ROUNDING - Trade timestamp rounds to future bucket despite being in past`;
      }

      console.warn(
        '[CandleBuilder] ⚠️ Trade creates FUTURE candle bucket (will be stored but not emitted yet):',
        {
          timeframe,
          ...roundingCalculation,
          rootCause,
          reason: 'TRADE TIMESTAMP CREATES FUTURE CANDLE BUCKET',
          explanation: `Trade timestamp ${new Date(trade.timestamp).toISOString()} rounds to ${new Date(candleTime).toISOString()} which is ${Math.round((candleTime - currentBucketTime) / 1000)}s in the future. Candle will be created but emission will be blocked until it becomes the current bucket.`,
          diagnostic: {
            tradeAge:
              tradeTimeVsNow > 0
                ? `${Math.round(tradeTimeVsNow / 1000)}s in future`
                : `${Math.abs(Math.round(tradeTimeVsNow / 1000))}s in past`,
            bucketBoundary: roundingCalculation.isNearBucketBoundary
              ? `YES - ${secondsUntilNextBucket}s until ${roundingCalculation.bucketBoundaryTime}`
              : 'NO',
            likelyCause: rootCause,
          },
        },
      );
      // Continue - we'll create the candle but emission logic will prevent sending it
    }

    if (!candle) {
      // 🔥 CRITICAL: Get the previous candle's close price for proper OHLC continuity
      const previousClosePrice = this.lastClosePrices.get(timeframe);
      const openPrice = previousClosePrice !== undefined ? previousClosePrice : trade.price;

      // 🔥 NEW: Initialize candle with trade buffer for VWAP
      // 🔥 CRITICAL: high/low must include BOTH open and trade price to maintain OHLC validity
      // If trade price is lower than open, high must still be >= open
      // If trade price is higher than open, low must still be <= open
      candle = {
        time: candleTime,
        open: openPrice, // Use previous candle's close as new open
        high: Math.max(openPrice, trade.price), // ✅ high must be >= open
        low: Math.min(openPrice, trade.price), // ✅ low must be <= open
        close: trade.price, // Will be recalculated as VWAP when more trades arrive
        volume: trade.volume,
        // New fields for VWAP
        trades: [trade],
        totalValue: trade.price * trade.volume,
        isFinalized: false,
        lastUpdateTime: Date.now(), // 🔥 NEW: Track when candle was last updated
      };
      this.currentCandles.set(key, candle);

      const now = Date.now();
      const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;
      const mostRecentSent = this.mostRecentCandleTimeSent.get(timeframe) || 0;

      console.log(`[CandleBuilder] ✅ NEW ${timeframe} candle created`, {
        candleTime: candleTime,
        candleTimeISO: new Date(candleTime).toISOString(),
        tradeTime: trade.timestamp,
        tradeTimeISO: new Date(trade.timestamp).toISOString(),
        currentTime: now,
        currentTimeISO: new Date(now).toISOString(),
        currentBucketTime: currentBucketTime,
        currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
        isCurrentBucket: candleTime === currentBucketTime,
        candleAgeMs: now - candleTime,
        tradeAgeMs: now - trade.timestamp,
        open: openPrice.toFixed(8),
        close: trade.price.toFixed(8),
        volume: trade.volume.toFixed(4),
        hasPreviousClose: previousClosePrice !== undefined,
        mostRecentSent: mostRecentSent,
        mostRecentSentISO:
          mostRecentSent > 0 ? new Date(mostRecentSent).toISOString() : 'NEVER_SET',
        willBeBlocked: candleTime < mostRecentSent ? 'YES - WILL BE BLOCKED!' : 'NO - SHOULD EMIT',
        timeDifference: candleTime - mostRecentSent,
      });
    } else if (isSynthetic) {
      // 🔥 NEW: Update synthetic candle with real trade data
      // Keep the open (which was set to previous close), but update OHLC with real prices
      candle.trades.push(trade);
      candle.totalValue += trade.price * trade.volume;
      candle.volume += trade.volume;

      // Recalculate OHLC with sorted trades
      const sortedPrices = candle.trades.map((t) => t.price);

      // 🔥 FIX: High/Low should ONLY use actual trade prices
      // Don't include open (which is from previous candle) to avoid phantom wicks
      // Safety: If no trades yet, use open as fallback
      candle.high = sortedPrices.length > 0 ? Math.max(...sortedPrices) : candle.open;
      candle.low = sortedPrices.length > 0 ? Math.min(...sortedPrices) : candle.open;

      // 🔥 VWAP for close price
      candle.close = candle.volume > 0 ? candle.totalValue / candle.volume : candle.open;

      // Mark as no longer synthetic
      this.syntheticCandles.delete(key);

      if (this.debug) {
        console.log(`[CandleBuilder] 🔄 Converted synthetic to real candle:`, {
          trades: candle.trades.length,
          vwapClose: candle.close,
          candleTime: new Date(candle.time).toISOString(),
        });
      }
    } else {
      // 🔥 CRITICAL FIX: Check if candle is finalized first
      // BUT allow un-finalizing if it's a previous bucket trade within grace period
      const now = Date.now();
      const intervalMs = this.getIntervalMs(timeframe);
      const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;
      const isPreviousBucket = candleTime === currentBucketTime - intervalMs;
      const candleAge = now - candleTime;
      
      if (candle.isFinalized) {
        // Allow updating previous bucket even if finalized (BitQuery delays)
        if (isPreviousBucket && candleAge < 2 * intervalMs) {
          console.log(
            '[CandleBuilder] 🔄 Un-finalizing previous bucket candle for late trade:',
            {
              timeframe,
              candleTime: new Date(candle.time).toISOString(),
              tradeTime: new Date(trade.timestamp).toISOString(),
              tradeType: trade.isBuy ? 'BUY' : 'SELL',
              candleAge: Math.round(candleAge / 1000) + 's',
              reason: 'PREVIOUS BUCKET - Late BitQuery trade arrived',
            },
          );
          // Un-finalize to allow this update
          candle.isFinalized = false;
        } else {
          console.error(`[CandleBuilder] ❌ TRADE REJECTED - Candle is finalized!`, {
            candleTime: new Date(candle.time).toISOString(),
            tradeTime: new Date(trade.timestamp).toISOString(),
            tradeType: trade.isBuy ? 'BUY' : 'SELL',
            price: trade.price,
            volume: trade.volume,
            timeframe,
            ageMinutes: Math.round((Date.now() - candle.time) / 60000),
            isPreviousBucket,
            candleAge: Math.round(candleAge / 1000) + 's',
          });
          return;
        }
      }

      // Update existing real candle with VWAP calculation
      candle.trades.push(trade);

      // Sort trades chronologically
      candle.trades.sort((a, b) => a.timestamp - b.timestamp);

      // Recalculate OHLC from sorted trades
      const sortedPrices = candle.trades.map((t) => t.price);

      // 🔥 CRITICAL: Open should NEVER change after initial creation
      // Open was set when candle was created, don't recalculate it!
      // (Keep existing candle.open value)

      // 🔥 FIX: High/Low should ONLY use actual trade prices
      // Don't include open (which is from previous candle) to avoid phantom wicks
      // Safety: If no trades yet, use open as fallback (shouldn't happen here but defensive)
      candle.high = sortedPrices.length > 0 ? Math.max(...sortedPrices) : candle.open;
      candle.low = sortedPrices.length > 0 ? Math.min(...sortedPrices) : candle.open;

      // 🔥 VWAP for close price
      candle.totalValue = candle.trades.reduce((sum, t) => sum + t.price * t.volume, 0);
      candle.volume = candle.trades.reduce((sum, t) => sum + t.volume, 0);
      candle.close = candle.volume > 0 ? candle.totalValue / candle.volume : candle.open;
    }

    // Store this candle's close price for potential future use
    this.lastClosePrices.set(timeframe, candle.close);

    // 🔥 NEW: Update lastUpdateTime for emission buffering
    candle.lastUpdateTime = Date.now();

    // 🔥 PHASE 2: Emit immediately if this is the current bucket
    // This provides near-instant updates for active trading
    this.emitCandleIfReady(timeframe, candle);

    // Clean up old candles (keep last 1000)
    this.cleanupOldCandles(timeframe, candleTime, 1000);

    // 🔥 NOTE: Finalization is now handled by the emission timer
    // Candles are finalized AFTER emission, not before
  }

  /**
   * 🔥 NEW: Finalize old candles to prevent late-arriving trades from modifying them
   * Also frees memory by clearing trade buffers
   */
  private finalizeOldCandles(timeframe: string): void {
    const now = Date.now();
    const finalizationDelay = 3 * 60 * 1000; // 3 minutes - reasonable buffer for Bitquery delays

    const prefix = `${timeframe}:`;
    let finalizedCount = 0;

    for (const [key, candle] of this.currentCandles.entries()) {
      if (!key.startsWith(prefix)) continue;

      const candleAge = now - candle.time;

      // Finalize candles older than 3 minutes
      if (!candle.isFinalized && candleAge > finalizationDelay) {
        candle.isFinalized = true;
        candle.trades = []; // Free memory - we no longer need the trade list
        finalizedCount++;

        if (this.debug) {
          console.log(`[CandleBuilder] 🔒 Finalized ${timeframe} candle:`, {
            candleTime: new Date(candle.time).toISOString(),
            ageMinutes: Math.round(candleAge / 60000),
          });
        }
      }
    }

    if (finalizedCount > 0 && this.debug) {
      console.log(`[CandleBuilder] Finalized ${finalizedCount} ${timeframe} candles`);
    }
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private getIntervalMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
    };

    return map[timeframe] || 60 * 1000; // Default to 1 minute
  }

  /**
   * Clean up old candles to prevent memory leaks
   */
  private cleanupOldCandles(timeframe: string, currentTime: number, keepCount: number): void {
    const prefix = `${timeframe}:`;
    const candleTimes: number[] = [];

    // Collect all candle times for this timeframe
    for (const key of this.currentCandles.keys()) {
      if (key.startsWith(prefix)) {
        const time = parseInt(key.split(':')[1]);
        candleTimes.push(time);
      }
    }

    // If we have too many, remove the oldest
    if (candleTimes.length > keepCount) {
      candleTimes.sort((a, b) => b - a); // Sort descending (newest first)
      const toRemove = candleTimes.slice(keepCount); // Get oldest candles to remove

      for (const time of toRemove) {
        this.currentCandles.delete(`${prefix}${time}`);
      }

      if (this.debug && toRemove.length > 0) {
        console.log(`[CandleBuilder] Cleaned up ${toRemove.length} old ${timeframe} candles`);
      }
    }
  }

  /**
   * Get the current candle for a timeframe (if it exists)
   */
  getCurrentCandle(timeframe: string): Candle | null {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(timeframe);
    const candleTime = Math.floor(now / intervalMs) * intervalMs;
    const key = `${timeframe}:${candleTime}`;

    return this.currentCandles.get(key) || null;
  }

  /**
   * Seed a candle with initial data (from REST API)
   * This prevents gaps when switching from REST to WebSocket
   */
  seedCandle(timeframe: string, candle: Candle): void {
    const key = `${timeframe}:${candle.time}`;
    const now = Date.now();
    const intervalMs = this.getIntervalMs(timeframe);
    const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;
    const isFutureBucket = candle.time > currentBucketTime;

    // 🔥 NOTE: Seeded candles can legitimately be slightly in the future
    // This happens when REST API returns the "current" bucket, but by the time
    // the frontend processes it, that bucket hasn't been reached yet
    // This is EXPECTED and normal - the candle will be emitted when the bucket becomes current
    if (isFutureBucket) {
      if (this.debug) {
        console.log('[CandleBuilder] ℹ️ Seeding future candle (expected on load):', {
          timeframe,
          candleTime: candle.time,
          candleTimeISO: new Date(candle.time).toISOString(),
          currentBucketTime: currentBucketTime,
          currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
          timeDifferenceMs: candle.time - currentBucketTime,
          reason:
            'REST API returned current bucket that is slightly in future - normal on page load',
        });
      }
    }

    // 🔥 NEW: Ensure seeded candles have VWAP fields initialized
    const seededCandle: Candle = {
      ...candle,
      trades: candle.trades || [],
      totalValue: candle.totalValue || 0,
      isFinalized: candle.isFinalized || false,
    };
    this.currentCandles.set(key, seededCandle);

    // 🔥 NEW: Store the close price for next candle continuity
    this.lastClosePrices.set(timeframe, candle.close);

    console.log(
      `[CandleBuilder] 🌱 Seeded ${timeframe} candle at ${new Date(candle.time).toISOString()} | close: ${candle.close} | ${isFutureBucket ? '⚠️ FUTURE CANDLE!' : 'OK'}`,
    );
  }

  /**
   * 🔥 NEW: Start the emission buffer timer
   * Checks every 500ms for candles that are ready to emit
   */
  private startEmissionTimer(): void {
    this.emissionTimer = setInterval(() => {
      this.checkAndEmitBufferedCandles();
    }, 500); // Check twice per second for responsiveness
  }

  /**
   * 🔥 PHASE 1: Check all candles and emit those that have aged past their buffer delay
   * Uses dual-speed delays: current bucket (500ms) vs previous buckets (5000ms)
   */
  private checkAndEmitBufferedCandles(): void {
    const now = Date.now();

    // 🔥 PHASE 1: Calculate current bucket time for each timeframe
    const currentBuckets = new Map<string, number>();
    for (const timeframe of this.callbacks.keys()) {
      const intervalMs = this.getIntervalMs(timeframe);
      currentBuckets.set(timeframe, Math.floor(now / intervalMs) * intervalMs);
    }

    // Group candles by timeframe
    const candlesByTimeframe = new Map<string, Candle[]>();

    for (const [key, candle] of this.currentCandles.entries()) {
      const timeframe = key.split(':')[0];
      if (!candlesByTimeframe.has(timeframe)) {
        candlesByTimeframe.set(timeframe, []);
      }
      candlesByTimeframe.get(timeframe)!.push(candle);
    }

    // Process each timeframe
    for (const [timeframe, candles] of candlesByTimeframe.entries()) {
      // Sort by time (oldest first) - CRITICAL: Maintain chronological order to prevent time violations
      const sortedCandles = candles.sort((a, b) => a.time - b.time);
      const currentBucketTime = currentBuckets.get(timeframe) || 0;

      // 🔥 CRITICAL FIX: Always process candles in chronological order
      // The mostRecentSent check below will handle skipping old candles
      for (const candle of sortedCandles) {
        // Check if candle is old enough to emit
        const timeSinceUpdate = now - candle.lastUpdateTime;
        const candleAge = now - candle.time;

        // 🔥 PHASE 1: Different emission delays based on bucket type (TradingView optimized)
        const isCurrentBucket = candle.time === currentBucketTime;
        const isFutureBucket = candle.time > currentBucketTime;
        const emissionDelay = isCurrentBucket
          ? this.CURRENT_BUCKET_DELAY_MS // Current bucket: 50ms (professional trader feel)
          : this.PREVIOUS_BUCKET_DELAY_MS; // Previous buckets: 1s grace period

        // 🔥 CRITICAL: Never emit FUTURE candles - they shouldn't exist!
        if (isFutureBucket) {
          const isSeededCandle = candle.trades.length === 0 && candle.volume === 0;
          const isSyntheticCandle = this.syntheticCandles.has(`${timeframe}:${candle.time}`);

          // Seeded candles from REST API can legitimately be slightly in the future
          // This happens when API returns "current" bucket but frontend hasn't reached it yet
          // This is EXPECTED and not an error - the candle will be emitted when bucket becomes current
          if (isSeededCandle) {
            // Silent skip for seeded candles - this is normal behavior
            // They'll be emitted automatically when the bucket becomes current
            continue;
          } else {
            // Real candles with trades shouldn't be in future - this is unexpected
            console.error('[CandleBuilder] 🚨 BLOCKING FUTURE CANDLE from timer emission:', {
              timeframe,
              candleTime: candle.time,
              candleTimeISO: new Date(candle.time).toISOString(),
              currentBucketTime: currentBucketTime,
              currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
              timeDifferenceMs: candle.time - currentBucketTime,
              reason: 'CANDLE IS IN FUTURE - Should not emit future candles!',
              candleSource: isSyntheticCandle ? 'SYNTHETIC' : 'REAL_WITH_TRADES',
              tradesCount: candle.trades.length,
              volume: candle.volume,
            });
          }
          continue; // Skip future candles - they shouldn't be emitted
        }

        // Emit if either:
        // 1. It's been emissionDelay since last update (no new trades for delay period)
        // 2. The candle is older than emissionDelay (handles late trades within window)
        const shouldEmit = timeSinceUpdate >= emissionDelay || candleAge >= emissionDelay;

        if (shouldEmit && !candle.isFinalized) {
          // 🔥 PHASE 3: Skip if we just emitted this via immediate path
          const key = `${timeframe}:${candle.time}`;
          const lastEmit = this.lastEmissionTime.get(key) || 0;
          const timeSinceLastEmit = now - lastEmit;

          if (timeSinceLastEmit < this.MIN_EMISSION_INTERVAL_MS) {
            if (this.debug) {
              console.log('[CandleBuilder] ⏱️ Skipping timer emission (recently emitted):', {
                timeframe,
                candleTime: new Date(candle.time).toISOString(),
                timeSinceLastEmit,
              });
            }
            continue; // Skip - was just emitted
          }

          // Check time violation before emitting
          const mostRecentSent = this.mostRecentCandleTimeSent.get(timeframe) || 0;
          const intervalMs = this.getIntervalMs(timeframe);

          // 🔥 CRITICAL FIX: Allow current/previous bucket candles even if mostRecentSent is newer
          // This handles cases where trades arrive out of order or a future candle was emitted first
          // Only block candles that are OLDER than mostRecentSent AND not in the current/previous bucket
          const isInCurrentOrPreviousBucket = candle.time >= currentBucketTime - intervalMs;
          const shouldBlock = candle.time < mostRecentSent && !isInCurrentOrPreviousBucket;

          if (shouldBlock) {
            // This is an OLD candle (from previous bucket), skip it
            console.error('[CandleBuilder] ⏮️ Buffered candle too old to emit:', {
              timeframe,
              candleTime: candle.time,
              candleTimeISO: new Date(candle.time).toISOString(),
              mostRecentSent: mostRecentSent,
              mostRecentSentISO: new Date(mostRecentSent).toISOString(),
              timeDifferenceMs: candle.time - mostRecentSent,
              timeDifferenceSeconds: Math.round((candle.time - mostRecentSent) / 1000),
              candleAgeMs: now - candle.time,
              mostRecentSentAgeMs: now - mostRecentSent,
              currentBucketTime: currentBucketTime,
              currentBucketTimeISO: new Date(currentBucketTime).toISOString(),
              isCurrentBucket: candle.time === currentBucketTime,
              isFromPreviousBucket: candle.time < currentBucketTime,
              isInCurrentOrPreviousBucket,
              source: 'checkAndEmitBufferedCandles',
            });
            continue;
          }
          // If candle.time === mostRecentSent or is in current/previous bucket, allow it!

          // 🔥 CRITICAL FIX: Only finalize candles from PREVIOUS time buckets
          // This allows trades to continue updating the CURRENT candle
          const isFromPreviousBucket = candle.time < currentBucketTime;

          if (isFromPreviousBucket) {
            // Mark as finalized - no more updates allowed
            candle.isFinalized = true;
          }
          // else: Don't finalize yet - it's the current bucket, keep accepting trades

          // 🔥 CRITICAL FIX: Always update mostRecentSent to maintain chronological order
          // This prevents time violations by ensuring we never emit older candles after newer ones
          const previousMostRecentSent = this.mostRecentCandleTimeSent.get(timeframe) || 0;
          this.mostRecentCandleTimeSent.set(timeframe, candle.time);

          // 🔥 DEBUG: Log when timer updates mostRecentSent
          if (previousMostRecentSent !== candle.time) {
            console.log('[CandleBuilder] 📝 TIMER UPDATING mostRecentCandleTimeSent:', {
              timeframe,
              previousValue: previousMostRecentSent,
              previousValueISO:
                previousMostRecentSent > 0
                  ? new Date(previousMostRecentSent).toISOString()
                  : 'NEVER_SET',
              newValue: candle.time,
              newValueISO: new Date(candle.time).toISOString(),
              changeMs: candle.time - previousMostRecentSent,
              source: 'checkAndEmitBufferedCandles',
            });
          }

          // 🔥 PHASE 3: Track emission time to prevent double-emission
          this.lastEmissionTime.set(key, now);

          // Emit to subscribers
          const callbacks = this.callbacks.get(timeframe) || [];

          if (this.debug && isCurrentBucket) {
            console.log('[CandleBuilder] 📡 Timer emitting current bucket candle:', {
              timeframe,
              candleTime: new Date(candle.time).toISOString(),
              isCurrentBucket,
              timeSinceUpdate,
              emissionDelay,
              close: candle.close,
              volume: candle.volume,
            });
          }

          for (const callback of callbacks) {
            try {
              callback({ ...candle }); // Send a copy
            } catch (error) {
              console.error('[CandleBuilder] Error in callback:', error);
            }
          }
        }
      }
    }

    // 🔥 Clean up very old finalized candles to free memory
    this.cleanupFinalizedCandles();
  }

  /**
   * 🔥 NEW: Clean up finalized candles older than 10 minutes to free memory
   */
  private cleanupFinalizedCandles(): void {
    const now = Date.now();
    const cleanupThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [, candle] of this.currentCandles.entries()) {
      if (candle.isFinalized) {
        const candleAge = now - candle.time;
        if (candleAge > cleanupThreshold) {
          // Clear trades array to free memory
          candle.trades = [];
        }
      }
    }
  }

  /**
   * Clear all candles (useful when switching tokens)
   */
  clear(): void {
    this.currentCandles.clear();
    this.lastClosePrices.clear();
    this.syntheticCandles.clear();
    this.mostRecentCandleTimeSent.clear(); // 🔥 NEW: Clear tracking on token switch
    this.lastEmissionTime.clear(); // 🔥 PHASE 3: Clear emission tracking

    // Stop all timers
    for (const [timeframe, timer] of this.timeframeTimers.entries()) {
      clearInterval(timer);
      if (this.debug) {
        console.log(`[CandleBuilder] ⏹️ Stopped timer for ${timeframe}`);
      }
    }
    this.timeframeTimers.clear();

    // Stop emission timer
    if (this.emissionTimer) {
      clearInterval(this.emissionTimer);
      this.emissionTimer = null;
    }

    if (this.debug) {
      console.log('[CandleBuilder] 🧹 Cleared all candles, close prices, and timers');
    }
  }

  /**
   * 🔥 NEW: Start time-driven emission timer for a timeframe
   * Emits synthetic candles when no trades occur to keep chart clock moving
   */
  private startTimeframeTimer(timeframe: string): void {
    // Clear existing timer if any
    if (this.timeframeTimers.has(timeframe)) {
      clearInterval(this.timeframeTimers.get(timeframe)!);
    }

    // Check every 1 second for bucket rollovers
    const timer = setInterval(() => {
      this.checkAndEmitSyntheticCandle(timeframe);
    }, 1000);

    this.timeframeTimers.set(timeframe, timer);
  }

  /**
   * 🔥 NEW: Stop time-driven emission timer for a timeframe
   */
  private stopTimeframeTimer(timeframe: string): void {
    const timer = this.timeframeTimers.get(timeframe);
    if (timer) {
      clearInterval(timer);
      this.timeframeTimers.delete(timeframe);
    }
  }

  /**
   * 🔥 PHASE 4: Check if we need to emit a synthetic candle for this timeframe
   *
   * CRITICAL FIX: Only create synthetic candles for PREVIOUS buckets, not current
   * This prevents empty candles from being emitted before real trades arrive,
   * which was causing the "1-trade-behind" issue where late Bitquery trades
   * get rejected because an empty synthetic candle already claimed that time bucket
   */
  private checkAndEmitSyntheticCandle(timeframe: string): void {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(timeframe);
    const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;

    // 🔥 PHASE 4: Don't create synthetic candles for the CURRENT bucket
    // Only fill gaps for PREVIOUS buckets to maintain smooth chart display
    const prefix = `${timeframe}:`;
    let mostRecentRealCandleTime = 0;

    for (const [key, candle] of this.currentCandles.entries()) {
      if (!key.startsWith(prefix)) continue;
      // Only consider candles with real trades (not synthetic)
      if (candle.trades.length > 0) {
        mostRecentRealCandleTime = Math.max(mostRecentRealCandleTime, candle.time);
      }
    }

    // If we have a recent real candle, fill any gaps up to (but NOT including) current bucket
    if (mostRecentRealCandleTime > 0) {
      let gapTime = mostRecentRealCandleTime + intervalMs;
      const previousClosePrice = this.lastClosePrices.get(timeframe);

      while (gapTime < currentBucketTime) {
        const key = `${timeframe}:${gapTime}`;
        const existingCandle = this.currentCandles.get(key);

        if (!existingCandle && previousClosePrice !== undefined) {
          // Create synthetic candle for the gap (NOT current bucket)
          const syntheticCandle: Candle = {
            time: gapTime,
            open: previousClosePrice,
            high: previousClosePrice,
            low: previousClosePrice,
            close: previousClosePrice,
            volume: 0,
            trades: [],
            totalValue: 0,
            isFinalized: false,
            lastUpdateTime: Date.now(),
          };

          this.currentCandles.set(key, syntheticCandle);
          this.syntheticCandles.add(key);

          if (this.debug) {
            console.log(
              `[CandleBuilder] 🌱 Synthetic gap candle created for ${timeframe}:`,
              new Date(gapTime).toISOString(),
            );
          }
        }

        gapTime += intervalMs;
      }
    }

    // Clean up old candles
    this.cleanupOldCandles(timeframe, currentBucketTime, 1000);
  }
}
