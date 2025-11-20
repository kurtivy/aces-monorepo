/**
 * Test Suite for Time-Driven Realtime Candle Builder
 * 
 * This test validates:
 * 1. Synthetic candle emission when no trades occur
 * 2. Real candle creation when trades arrive
 * 3. Conversion of synthetic → real candles when late trades arrive
 * 4. Timer lifecycle management
 * 5. OHLC continuity across candles
 */

import { RealtimeCandleBuilder, type Trade, type Candle } from './realtime-candle-builder';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class RealtimeCandleBuilderTester {
  private results: TestResult[] = [];

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n🧪 ========================================');
    console.log('🧪 Starting Realtime Candle Builder Tests');
    console.log('🧪 ========================================\n');

    await this.testSyntheticCandleEmission();
    await this.testRealCandleCreation();
    await this.testSyntheticToRealConversion();
    await this.testOHLCContinuity();
    await this.testTimerLifecycle();
    await this.testMultipleTimeframes();

    this.printResults();
  }

  /**
   * Test 1: Synthetic candles are emitted when no trades occur
   */
  private async testSyntheticCandleEmission(): Promise<void> {
    console.log('📊 Test 1: Synthetic Candle Emission (no trades)');
    
    const builder = new RealtimeCandleBuilder(true);
    const receivedCandles: Candle[] = [];

    // Subscribe to 1m timeframe
    const unsubscribe = builder.subscribe('1m', (candle) => {
      receivedCandles.push(candle);
    });

    // Seed initial candle
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    builder.seedCandle('1m', {
      time: oneMinuteAgo,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });

    // Wait for 2 seconds - should emit at least one synthetic candle
    await this.wait(2000);

    unsubscribe();
    builder.clear();

    const syntheticCandles = receivedCandles.filter(c => c.volume === 0);
    const passed = syntheticCandles.length > 0;

    this.results.push({
      testName: 'Synthetic Candle Emission',
      passed,
      message: passed 
        ? `✅ Emitted ${syntheticCandles.length} synthetic candle(s)`
        : '❌ No synthetic candles emitted',
      details: {
        totalCandles: receivedCandles.length,
        syntheticCandles: syntheticCandles.length,
        lastCandle: receivedCandles[receivedCandles.length - 1],
      },
    });

    console.log(`   ${passed ? '✅' : '❌'} Result: ${this.results[this.results.length - 1].message}\n`);
  }

  /**
   * Test 2: Real candles are created when trades arrive
   */
  private async testRealCandleCreation(): Promise<void> {
    console.log('📊 Test 2: Real Candle Creation (with trades)');
    
    const builder = new RealtimeCandleBuilder(true);
    const receivedCandles: Candle[] = [];

    const unsubscribe = builder.subscribe('1m', (candle) => {
      receivedCandles.push(candle);
    });

    // Seed initial candle
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    builder.seedCandle('1m', {
      time: oneMinuteAgo,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });

    // Process a real trade
    const trade: Trade = {
      timestamp: now,
      price: 103,
      volume: 500,
      isBuy: true,
    };
    builder.processTrade(trade);

    await this.wait(500);

    unsubscribe();
    builder.clear();

    const realCandles = receivedCandles.filter(c => c.volume > 0);
    const passed = realCandles.length > 0 && realCandles.some(c => c.close === 103);

    this.results.push({
      testName: 'Real Candle Creation',
      passed,
      message: passed 
        ? `✅ Created ${realCandles.length} real candle(s) with trade data`
        : '❌ No real candles created from trades',
      details: {
        totalCandles: receivedCandles.length,
        realCandles: realCandles.length,
        lastCandle: receivedCandles[receivedCandles.length - 1],
      },
    });

    console.log(`   ${passed ? '✅' : '❌'} Result: ${this.results[this.results.length - 1].message}\n`);
  }

  /**
   * Test 3: Synthetic candles can be converted to real when late trades arrive
   */
  private async testSyntheticToRealConversion(): Promise<void> {
    console.log('📊 Test 3: Synthetic → Real Conversion (late trades)');
    
    const builder = new RealtimeCandleBuilder(true);
    const receivedCandles: Candle[] = [];

    const unsubscribe = builder.subscribe('1m', (candle) => {
      receivedCandles.push(candle);
    });

    // Seed initial candle
    const now = Date.now();
    const twoMinutesAgo = now - 120000;
    builder.seedCandle('1m', {
      time: twoMinutesAgo,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });

    // Wait for synthetic candle to be emitted
    await this.wait(2000);

    const candlesBeforeTrade = receivedCandles.length;

    // Process a late trade that falls in the synthetic candle's bucket
    const currentBucket = Math.floor(now / 60000) * 60000;
    const lateTrade: Trade = {
      timestamp: currentBucket + 30000, // 30 seconds into current bucket
      price: 104,
      volume: 200,
      isBuy: true,
    };
    builder.processTrade(lateTrade);

    await this.wait(500);

    unsubscribe();
    builder.clear();

    const candlesAfterTrade = receivedCandles.length;
    const lastCandle = receivedCandles[receivedCandles.length - 1];
    const passed = lastCandle && lastCandle.volume > 0 && lastCandle.close === 104;

    this.results.push({
      testName: 'Synthetic → Real Conversion',
      passed,
      message: passed 
        ? '✅ Successfully converted synthetic candle to real with late trade'
        : '❌ Failed to convert synthetic candle',
      details: {
        candlesBeforeTrade,
        candlesAfterTrade,
        lastCandle,
        wasConverted: passed,
      },
    });

    console.log(`   ${passed ? '✅' : '❌'} Result: ${this.results[this.results.length - 1].message}\n`);
  }

  /**
   * Test 4: OHLC continuity is maintained across candles
   */
  private async testOHLCContinuity(): Promise<void> {
    console.log('📊 Test 4: OHLC Continuity (open = previous close)');
    
    const builder = new RealtimeCandleBuilder(true);
    const receivedCandles: Candle[] = [];

    const unsubscribe = builder.subscribe('1m', (candle) => {
      receivedCandles.push(candle);
    });

    // Seed initial candle
    const now = Date.now();
    const twoMinutesAgo = now - 120000;
    builder.seedCandle('1m', {
      time: twoMinutesAgo,
      open: 100,
      high: 105,
      low: 95,
      close: 102, // This should become the next candle's open
      volume: 1000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });

    // Wait for synthetic candle
    await this.wait(2000);

    unsubscribe();
    builder.clear();

    const syntheticCandles = receivedCandles.filter(c => c.volume === 0);
    const hasContinuity = syntheticCandles.length > 0 && syntheticCandles[0].open === 102;
    const passed = hasContinuity;

    this.results.push({
      testName: 'OHLC Continuity',
      passed,
      message: passed 
        ? '✅ OHLC continuity maintained (new open = previous close)'
        : '❌ OHLC continuity broken',
      details: {
        expectedOpen: 102,
        actualOpen: syntheticCandles[0]?.open,
        syntheticCandles,
      },
    });

    console.log(`   ${passed ? '✅' : '❌'} Result: ${this.results[this.results.length - 1].message}\n`);
  }

  /**
   * Test 5: Timers are properly managed (start/stop)
   */
  private async testTimerLifecycle(): Promise<void> {
    console.log('📊 Test 5: Timer Lifecycle Management');
    
    const builder = new RealtimeCandleBuilder(true);
    const receivedCandles: Candle[] = [];

    // Seed initial candle
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    builder.seedCandle('1m', {
      time: oneMinuteAgo,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });

    // Subscribe
    const unsubscribe = builder.subscribe('1m', (candle) => {
      receivedCandles.push(candle);
    });

    // Wait for candles
    await this.wait(2000);
    const candlesWhileSubscribed = receivedCandles.length;

    // Unsubscribe
    unsubscribe();

    // Wait to ensure no more candles are emitted
    await this.wait(2000);
    const candlesAfterUnsubscribe = receivedCandles.length;

    builder.clear();

    const passed = candlesWhileSubscribed > 0 && candlesWhileSubscribed === candlesAfterUnsubscribe;

    this.results.push({
      testName: 'Timer Lifecycle',
      passed,
      message: passed 
        ? '✅ Timer properly stopped after unsubscribe'
        : '❌ Timer continued running after unsubscribe',
      details: {
        candlesWhileSubscribed,
        candlesAfterUnsubscribe,
        difference: candlesAfterUnsubscribe - candlesWhileSubscribed,
      },
    });

    console.log(`   ${passed ? '✅' : '❌'} Result: ${this.results[this.results.length - 1].message}\n`);
  }

  /**
   * Test 6: Multiple timeframes work independently
   */
  private async testMultipleTimeframes(): Promise<void> {
    console.log('📊 Test 6: Multiple Timeframes (independent timers)');
    
    const builder = new RealtimeCandleBuilder(true);
    const candles1m: Candle[] = [];
    const candles5m: Candle[] = [];

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Seed both timeframes
    builder.seedCandle('1m', {
      time: oneMinuteAgo,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });
    builder.seedCandle('5m', {
      time: Math.floor(oneMinuteAgo / 300000) * 300000,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 5000,
      // 🔥 NEW: VWAP fields
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(),
    });

    // Subscribe to both
    const unsub1m = builder.subscribe('1m', (candle) => {
      candles1m.push(candle);
    });
    const unsub5m = builder.subscribe('5m', (candle) => {
      candles5m.push(candle);
    });

    // Wait for synthetic candles
    await this.wait(2000);

    unsub1m();
    unsub5m();
    builder.clear();

    const has1mCandles = candles1m.length > 0;
    const has5mCandles = candles5m.length > 0;
    const passed = has1mCandles && has5mCandles;

    this.results.push({
      testName: 'Multiple Timeframes',
      passed,
      message: passed 
        ? '✅ Both timeframes emitted candles independently'
        : '❌ Some timeframes did not emit candles',
      details: {
        candles1m: candles1m.length,
        candles5m: candles5m.length,
      },
    });

    console.log(`   ${passed ? '✅' : '❌'} Result: ${this.results[this.results.length - 1].message}\n`);
  }

  /**
   * Print test results summary
   */
  private printResults(): void {
    console.log('\n🎯 ========================================');
    console.log('🎯 Test Results Summary');
    console.log('🎯 ========================================\n');

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   ${result.message}`);
      if (result.details && !result.passed) {
        console.log(`   Details:`, result.details);
      }
      console.log('');
    });

    console.log('─────────────────────────────────────────');
    console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('─────────────────────────────────────────\n');

    if (failedTests === 0) {
      console.log('🎉 All tests passed! Time-driven candle emission is working correctly.\n');
    } else {
      console.log('⚠️  Some tests failed. Review the details above.\n');
    }
  }

  /**
   * Helper: Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Run tests (call this from browser console or Node.js)
 */
export async function testRealtimeCandles(): Promise<void> {
  const tester = new RealtimeCandleBuilderTester();
  await tester.runAllTests();
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  console.log('');
  console.log('💡 To run the test suite, execute:');
  console.log('   testRealtimeCandles()');
  console.log('');
  
  // Expose to window for easy access
  (window as any).testRealtimeCandles = testRealtimeCandles;
}

