import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers/workout-api-mocks';

test.describe('Daily Log — Weight entry', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.route('**/api/logs**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/?tab=stats');
  });

  test('weight input field is visible on stats tab', async ({ page }) => {
    const weightInput = page.getByPlaceholder(/87\.|weight/i).first();
    await expect(weightInput).toBeVisible();
  });

  test('can enter and submit a weight', async ({ page }) => {
    const input = page.getByPlaceholder(/87\.|weight/i).first();
    await input.fill('84.5');

    const submitBtn = page.getByRole('button', { name: /log|save|add/i }).first();
    await submitBtn.click();

    await expect(page.locator('body')).not.toContainText('Error');
  });
});

test.describe('Daily Log — Diet entry', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.route('**/api/logs', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          goals: {
            targetCaloriesKcal: 1850,
            targetProteinG: 180,
            targetCarbsG: 113,
            targetFatG: 75,
          },
        }),
      });
    });
    await page.goto('/?tab=diet');
  });

  test('shows macro input fields', async ({ page }) => {
    await expect(page.getByText(/calories/i).first()).toBeVisible();
    await expect(page.getByText(/protein/i).first()).toBeVisible();
  });

  test('can fill and submit diet data', async ({ page }) => {
    const calInput = page.getByRole('spinbutton').nth(0);
    await calInput.fill('1750');

    const protInput = page.getByRole('spinbutton').nth(1);
    await protInput.fill('175');

    await page.getByRole('button', { name: /save intake/i }).click();

    await expect(page.locator('body')).not.toContainText('Error');
  });
});
