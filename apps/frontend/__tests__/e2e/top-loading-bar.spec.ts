import { test, expect } from '@playwright/test';

test.describe('Top Loading Bar', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('/');
  });

  test('should be visible on initial page load', async ({ page }) => {
    const loadingBar = page.locator('data-testid=top-loading-bar');
    await expect(loadingBar).toBeVisible();
  });

  test('should eventually disappear after loading', async ({ page }) => {
    const loadingBar = page.locator('data-testid=top-loading-bar');
    // Give it a generous timeout for the current complex loading system
    await expect(loadingBar).toBeHidden({ timeout: 15000 });
  });
});
