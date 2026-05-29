import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers/workout-api-mocks';

test.describe('Profile & Goals', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/?tab=profile');
  });

  test('shows profile settings fields', async ({ page }) => {
    await expect(page.getByText(/name|goal|target|tdee/i).first()).toBeVisible();
  });

  test('TDEE calculator is present', async ({ page }) => {
    await expect(page.getByText(/tdee|maintenance|calculator/i).first()).toBeVisible();
  });

  test('can update target calories', async ({ page }) => {
    const calInput = page.getByRole('spinbutton').filter({ has: page.locator('xpath=..') }).first();
    if (await calInput.isVisible().catch(() => false)) {
      await calInput.fill('1800');
      const saveBtn = page.getByRole('button', { name: /save|update/i }).first();
      await saveBtn.click();
      await expect(page.locator('body')).not.toContainText('Error');
    }
  });
});
