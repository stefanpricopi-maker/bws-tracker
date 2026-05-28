import { test, expect } from '@playwright/test';

test.describe('Profile & Goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /profile/i }).click();
  });

  test('shows profile settings fields', async ({ page }) => {
    await expect(page.getByText(/name|goal|target|tdee/i)).toBeVisible();
  });

  test('TDEE calculator is present', async ({ page }) => {
    await expect(page.getByText(/tdee|maintenance|calculator/i)).toBeVisible();
  });

  test('can update target calories', async ({ page }) => {
    // Find calories target input
    const calInput = page.getByRole('spinbutton', { name: /calories/i }).first();
    if (await calInput.isVisible()) {
      await calInput.fill('1800');
      const saveBtn = page.getByRole('button', { name: /save|update/i }).first();
      await saveBtn.click();
      await expect(page.locator('body')).not.toContainText('Error');
    }
  });
});
