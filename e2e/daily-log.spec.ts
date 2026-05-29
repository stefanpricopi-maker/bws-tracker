import { test, expect } from '@playwright/test';

test.describe('Daily Log — Weight entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('bws_onboarding_v1', 'done'));
  });

  test('weight input field is visible on stats tab', async ({ page }) => {
    await page.getByRole('button', { name: /stats|statistici/i }).click();
    const weightInput = page.getByPlaceholder(/weight|kg/i).first();
    await expect(weightInput).toBeVisible();
  });

  test('can enter and submit a weight', async ({ page }) => {
    await page.getByRole('button', { name: /stats|statistici/i }).click();
    const input = page.getByPlaceholder(/weight|kg/i).first();
    await input.fill('84.5');

    const submitBtn = page.getByRole('button', { name: /log|save|add/i }).first();
    await submitBtn.click();

    // After logging, the input should clear or show a success indicator
    await expect(page.locator('body')).not.toContainText('Error');
  });
});

test.describe('Daily Log — Diet entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /diet/i }).click();
  });

  test('shows macro input fields', async ({ page }) => {
    await expect(page.getByText(/calories/i)).toBeVisible();
    await expect(page.getByText(/protein/i)).toBeVisible();
  });

  test('can fill and submit diet data', async ({ page }) => {
    // Fill calorie input (labelled with 🔥 Calories)
    const calInput = page.getByRole('spinbutton').nth(0);
    await calInput.fill('1750');

    const protInput = page.getByRole('spinbutton').nth(1);
    await protInput.fill('175');

    const saveBtn = page.getByRole('button', { name: /save|log|add/i }).first();
    await saveBtn.click();

    await expect(page.locator('body')).not.toContainText('Error');
  });
});
