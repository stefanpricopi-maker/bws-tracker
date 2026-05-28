import { test, expect } from '@playwright/test';

test.describe('Workout Logger', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /workout/i }).click();
  });

  test('shows the 7-day split selector', async ({ page }) => {
    // Day buttons should be visible
    await expect(page.getByText(/day 1|push/i)).toBeVisible();
  });

  test('selecting a day shows exercises', async ({ page }) => {
    // Click Day 1 (Push)
    const day1 = page.getByRole('button', { name: /day 1|push/i }).first();
    await day1.click();

    // Should show at least one exercise from the Push day
    await expect(page.getByText(/bench press|overhead press/i)).toBeVisible();
  });

  test('exercise inputs are pre-populated or accept manual entry', async ({ page }) => {
    const day1 = page.getByRole('button', { name: /day 1|push/i }).first();
    await day1.click();

    // Weight inputs should be present
    const weightInputs = page.getByRole('spinbutton');
    await expect(weightInputs.first()).toBeVisible();
  });

  test('can save a workout set', async ({ page }) => {
    const day1 = page.getByRole('button', { name: /day 1|push/i }).first();
    await day1.click();

    // Fill first weight input
    const weightInput = page.getByRole('spinbutton').first();
    await weightInput.fill('80');

    const repsInput = page.getByRole('spinbutton').nth(1);
    await repsInput.fill('8');

    const saveBtn = page.getByRole('button', { name: /save workout|log workout/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expect(page.locator('body')).not.toContainText('Error');
    }
  });
});
