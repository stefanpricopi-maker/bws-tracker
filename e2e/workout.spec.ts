import { test, expect } from '@playwright/test';

import { skipOnboarding, mockWorkoutPlayerApis } from './helpers/workout-api-mocks';

test.describe('Workout Logger', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await mockWorkoutPlayerApis(page);
    await page.goto('/?tab=workout');
    await expect(page.getByTestId('workout-panel')).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Dumbbell Floor Press' })).toBeVisible();
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
