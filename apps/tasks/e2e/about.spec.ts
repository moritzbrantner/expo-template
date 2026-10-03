import { expect, test } from '@playwright/test';

test('opens the quiet about page from the task footer and returns', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
    });
  });

  await page.goto('/');

  await page.getByRole('link', { name: 'About' }).click();

  await expect(page.getByText('A small place for the next thing.')).toBeVisible();
  await expect(page.getByText('Local by default')).toBeVisible();
  await expect(page.getByText('Dictation')).toBeVisible();

  await page.getByRole('button', { name: 'Back to tasks' }).click();
  await expect(page.getByText('Write it down. Finish it. Move on.')).toBeVisible();
});
