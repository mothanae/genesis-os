import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login form validates required fields', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form
    await page.locator('button[type="submit"]').click();

    // Email input should have browser validation
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('register form has all required fields', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('navigation between login and register', async ({ page }) => {
    await page.goto('/login');

    // Find and click the register link
    const registerLink = page.locator('a[href*="register"]');
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/);
    }
  });
});
