import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers/workout-api-mocks';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
  });

  test('loads the home tab with daily hero', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible();
  });

  test('shows all main navigation tabs', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('button', { name: /home/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /workout|antrenament/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /diet|dietă/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /stats|statistici/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /profile|profil/i })).toBeVisible();
  });

  test('switches to Workout tab', async ({ page }) => {
    await page.goto('/?tab=workout');
    await expect(page.getByTestId('workout-panel')).toBeVisible({ timeout: 15_000 });
  });

  test('switches to Diet tab', async ({ page }) => {
    await page.goto('/?tab=diet');
    await expect(page.getByText(/calories/i).first()).toBeVisible();
  });

  test('switches to Stats tab and shows Performance Score', async ({ page }) => {
    await page.goto('/?tab=stats');
    await expect(page.getByText('Performance Score')).toBeVisible();
  });

  test('switches to Profile tab', async ({ page }) => {
    await page.goto('/?tab=profile');
    await expect(page.getByText(/goal|target|tdee/i).first()).toBeVisible();
  });
});
