import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the main page and shows the Performance Score section', async ({ page }) => {
    await expect(page.getByText('Performance Score')).toBeVisible();
  });

  test('shows the bottom/top navigation with all 4 tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /workout/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /diet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /profile/i })).toBeVisible();
  });

  test('switches to Workout tab', async ({ page }) => {
    await page.getByRole('button', { name: /workout/i }).click();
    await expect(page.getByText(/day 1|day 2|day 3|push|pull|legs/i)).toBeVisible();
  });

  test('switches to Diet tab', async ({ page }) => {
    await page.getByRole('button', { name: /diet/i }).click();
    await expect(page.getByText(/calories/i)).toBeVisible();
  });

  test('switches to Profile tab', async ({ page }) => {
    await page.getByRole('button', { name: /profile/i }).click();
    await expect(page.getByText(/goal|target|tdee/i)).toBeVisible();
  });
});
