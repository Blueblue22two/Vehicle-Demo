import { expect, test } from '@playwright/test';

test('loads the application shell', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: '3D 智舱车控 Demo' }),
  ).toBeVisible();
});
