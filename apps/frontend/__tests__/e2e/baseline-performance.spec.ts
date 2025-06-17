import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Define types for better type safety
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface BaselineMetrics {
  browser: string;
  timestamp: string;
  loadingPerformance: {
    timeToFirstContentfulPaint: number;
    loadingPhaseDuration: number;
    introAnimationDuration: number;
    totalTimeToInteractive: number;
    navigationTime: number;
    loadingCompleted: boolean;
    canvasReady: boolean;
  };
  consoleErrors: Array<{
    text: string;
    location: object;
    timestamp: number;
  }>;
  networkRequests: Array<{
    url: string;
    status: number;
  }>;
  memoryUsage: MemoryInfo | null;
  issuesObserved: {
    loadingStuck: boolean;
    consoleErrors: string[];
    visualGlitches: string[];
    performanceStuttering: string[];
  };
}

// Baseline Performance Test - Following Diagnostic Validation Framework
test.describe('Baseline Performance Metrics', () => {
  const baselineResults: { [key: string]: BaselineMetrics } = {};

  test.beforeAll(async () => {
    // Create baseline results directory
    const resultsDir = path.join(__dirname, 'baseline-results');
    await fs.mkdir(resultsDir, { recursive: true });
  });

  test.afterAll(async () => {
    // Save baseline results
    const resultsPath = path.join(__dirname, 'baseline-results', 'baseline-metrics.json');
    await fs.writeFile(resultsPath, JSON.stringify(baselineResults, null, 2));
    console.log('📊 Baseline metrics saved to:', resultsPath);
  });

  ['chromium', 'firefox', 'webkit'].forEach((browserName) => {
    test.describe(`${browserName} baseline`, () => {
      test(`should capture comprehensive loading metrics for ${browserName}`, async ({
        page,
        browserName: browser,
      }) => {
        // Skip if not the current browser
        if (browser !== browserName) return;

        console.log(`🔍 Testing ${browserName} baseline...`);

        // Initialize metrics collection
        const metrics: BaselineMetrics = {
          browser: browserName,
          timestamp: new Date().toISOString(),
          loadingPerformance: {
            timeToFirstContentfulPaint: 0,
            loadingPhaseDuration: 0,
            introAnimationDuration: 0,
            totalTimeToInteractive: 0,
            navigationTime: 0,
            loadingCompleted: false,
            canvasReady: false,
          },
          consoleErrors: [],
          networkRequests: [],
          memoryUsage: null,
          issuesObserved: {
            loadingStuck: false,
            consoleErrors: [],
            visualGlitches: [],
            performanceStuttering: [],
          },
        };

        // Capture console logs and errors
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            metrics.consoleErrors.push({
              text: msg.text(),
              location: msg.location(),
              timestamp: Date.now(),
            });
          }
        });

        // Capture network requests
        page.on('response', (response) => {
          metrics.networkRequests.push({
            url: response.url(),
            status: response.status(),
          });
        });

        // Navigate to homepage
        const navigationStart = Date.now();
        await page.goto('/', { waitUntil: 'networkidle' });
        const navigationEnd = Date.now();

        // Wait for and measure loading phases
        const loadingBar = page.locator('[data-testid="top-loading-bar"]');

        // Time to First Contentful Paint (approximate)
        await page.waitForSelector('body', { state: 'visible' });
        const firstContentfulPaint = Date.now();

        // Wait for loading to complete
        let loadingCompleted = false;
        let loadingDuration = 0;

        try {
          await expect(loadingBar).toBeHidden({ timeout: 20000 });
          loadingCompleted = true;
          loadingDuration = Date.now() - navigationStart;
        } catch (error) {
          console.warn(`❌ Loading did not complete within 20s for ${browserName}`);
          metrics.issuesObserved.loadingStuck = true;
          loadingDuration = 20000; // Max timeout
        }

        // Wait for canvas to be interactive
        let canvasReady = false;
        let totalTimeToInteractive = 0;

        try {
          await page.waitForSelector('canvas', { state: 'visible', timeout: 5000 });
          canvasReady = true;
          totalTimeToInteractive = Date.now() - navigationStart;
        } catch (error) {
          console.warn(`❌ Canvas not ready within 5s for ${browserName}`);
          totalTimeToInteractive = Date.now() - navigationStart;
        }

        // Check for intro animation
        let introAnimationDuration = 0;
        const introElements = page.locator('.neon-text, .neon-logo');
        const introCount = await introElements.count();

        if (introCount > 0) {
          console.log(`🎬 Intro animation detected in ${browserName}`);
          // Wait for intro animation to complete
          try {
            await page.waitForTimeout(4000); // Max intro time
            introAnimationDuration = 4000;
          } catch (error) {
            console.warn(`❌ Intro animation issues in ${browserName}`);
          }
        }

        // Capture performance metrics
        const performanceMetrics = await page.evaluate(() => {
          const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const memory = (performance as Performance & { memory?: MemoryInfo }).memory;

          return {
            domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
            loadComplete: perf.loadEventEnd - perf.loadEventStart,
            memory: memory
              ? {
                  usedJSHeapSize: memory.usedJSHeapSize,
                  totalJSHeapSize: memory.totalJSHeapSize,
                  jsHeapSizeLimit: memory.jsHeapSizeLimit,
                }
              : null,
          };
        });

        // Populate metrics
        metrics.loadingPerformance = {
          timeToFirstContentfulPaint: firstContentfulPaint - navigationStart,
          loadingPhaseDuration: loadingDuration,
          introAnimationDuration: introAnimationDuration,
          totalTimeToInteractive: totalTimeToInteractive,
          navigationTime: navigationEnd - navigationStart,
          loadingCompleted: loadingCompleted,
          canvasReady: canvasReady,
        };

        metrics.memoryUsage = performanceMetrics.memory;

        // Analyze issues
        metrics.issuesObserved.consoleErrors = metrics.consoleErrors.map((err) => err.text);

        // Check for specific known issues
        if (metrics.consoleErrors.length > 0) {
          console.log(`⚠️  ${metrics.consoleErrors.length} console errors in ${browserName}`);
        }

        if (loadingDuration > 10000) {
          console.log(`⚠️  Slow loading detected in ${browserName}: ${loadingDuration}ms`);
        }

        // Store baseline for this browser
        baselineResults[browserName] = metrics;

        // Log summary
        console.log(`📊 ${browserName} Baseline Summary:`);
        console.log(`   - Time to Interactive: ${totalTimeToInteractive}ms`);
        console.log(`   - Loading Duration: ${loadingDuration}ms`);
        console.log(`   - Console Errors: ${metrics.consoleErrors.length}`);
        console.log(`   - Network Requests: ${metrics.networkRequests.length}`);
        console.log(`   - Loading Completed: ${loadingCompleted}`);
        console.log(`   - Canvas Ready: ${canvasReady}`);

        // Basic assertions to ensure the test framework is working
        expect(page.url()).toContain('localhost:3000');
        expect(totalTimeToInteractive).toBeGreaterThan(0);
        expect(metrics.networkRequests.length).toBeGreaterThan(0);
      });
    });
  });
});
