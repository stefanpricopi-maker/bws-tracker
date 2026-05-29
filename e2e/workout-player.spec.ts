import { test, expect } from '@playwright/test';
import { mockWorkoutPlayerApis, skipOnboarding } from './helpers/workout-api-mocks';

test.describe('Workout Player', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await mockWorkoutPlayerApis(page);
    await page.goto('/?tab=workout');
    await expect(page.getByTestId('workout-panel')).toBeVisible({ timeout: 15_000 });
  });

  async function openAiPlanAndStartPlayer(page: import('@playwright/test').Page) {
    await page.getByTestId('ai-planner-toggle').scrollIntoViewIfNeeded();
    await page.getByTestId('ai-planner-toggle').click();
    await page.getByTestId('generate-weekly-plan').click();
    await expect(page.getByTestId('start-player').first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('start-player').first().click();
    await expect(page.getByTestId('player-loading')).toBeHidden({ timeout: 20_000 });
  }

  test('warmup → working set → save → rest screen', async ({ page }) => {
    await openAiPlanAndStartPlayer(page);

    await expect(page.getByText('Warmup before working sets')).toBeVisible();
    await page.getByTestId('warmup-done').click();

    await expect(page.getByText(/Set 1.*of.*2/i)).toBeVisible();

    const spinbuttons = page.getByRole('spinbutton');
    await spinbuttons.nth(0).fill('40');
    await spinbuttons.nth(1).fill('10');

    await page.getByTestId('save-set').click();

    await expect(page.getByText('Set Saved!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('skip-rest')).toBeVisible();
  });

  test('can skip rest and return to next set', async ({ page }) => {
    await openAiPlanAndStartPlayer(page);

    await page.getByTestId('warmup-done').click();
    const spinbuttons = page.getByRole('spinbutton');
    await spinbuttons.nth(0).fill('40');
    await spinbuttons.nth(1).fill('10');
    await page.getByTestId('save-set').click();

    await expect(page.getByText('Set Saved!')).toBeVisible();
    await page.getByTestId('skip-rest').click();

    await expect(page.getByText(/Set 2.*of.*2/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('save-set')).toBeVisible();
  });
});
