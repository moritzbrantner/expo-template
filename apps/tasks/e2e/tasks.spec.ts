import { expect, test, type Page } from '@playwright/test';

async function resetTaskApp(page: Page) {
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
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('Nothing here yet. Add one thing worth doing.')).toBeVisible();
}

async function waitForStoredValue(page: Page, fragment: string) {
  await expect
    .poll(() =>
      page.evaluate((expected) => {
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          const value = key ? localStorage.getItem(key) : null;
          if (value?.includes(expected)) {
            return true;
          }
        }
        return false;
      }, fragment),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await resetTaskApp(page);
});

test('adds, completes, filters, and restores a persisted task', async ({ page }) => {
  await page.getByLabel('New task').fill('  Buy   milk  ');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Buy milk')).toBeVisible();
  await expect(page.getByText('1 open · 0 done')).toBeVisible();

  await page.getByRole('checkbox', { name: 'Complete Buy milk' }).click();
  await expect(page.getByText('0 open · 1 done')).toBeVisible();
  await expect(page.getByText('Everything is complete.')).toBeVisible();

  await page.getByRole('tab', { name: 'Done' }).click();
  await expect(page.getByText('Buy milk')).toBeVisible();

  await waitForStoredValue(page, 'Buy milk');
  await page.reload();

  await expect(page.getByText('0 open · 1 done')).toBeVisible();
  await page.getByRole('tab', { name: 'Done' }).click();
  await expect(page.getByText('Buy milk')).toBeVisible();
});

test('validates, persists, applies, and resets custom dictation command words', async ({ page }) => {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByText('Dictation commands')).toBeVisible();

  const nextInput = page.getByLabel('New entry dictation word');
  const doneInput = page.getByLabel('Finish dictation word');
  const saveButton = page.getByRole('button', { name: 'Save' });

  await nextInput.fill('weiter');
  await doneInput.fill('WEITER');
  await expect(page.getByText('The two command words must be different.')).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await doneInput.fill('FERTIG');
  await saveButton.click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(nextInput).toHaveValue('weiter');
  await expect(doneInput).toHaveValue('fertig');

  await page.getByRole('button', { name: 'Back to tasks' }).click();
  await expect(
    page.getByText('Dictate several tasks hands-free. “weiter” starts a new entry; “fertig” finishes.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Start dictation' }).click();
  const dictatedTask = page.getByLabel('Dictated task');
  await expect(dictatedTask).toBeVisible();
  await expect(
    page.getByText(
      'Dictation mode is on. Use the keyboard microphone: say “weiter” for a new task and “fertig” to finish.',
    ),
  ).toBeVisible();

  await dictatedTask.fill('Buy milk weiter Call dentist fertig');

  await expect(page.getByLabel('New task')).toBeVisible();
  await expect(page.getByText('2 open · 0 done')).toBeVisible();
  await expect(page.getByText('Call dentist')).toBeVisible();
  await expect(page.getByText('Buy milk')).toBeVisible();

  await waitForStoredValue(page, 'weiter');
  await page.reload();
  await expect(
    page.getByText('Dictate several tasks hands-free. “weiter” starts a new entry; “fertig” finishes.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Reset defaults' }).click();
  await expect(page.getByText('Reset to defaults.')).toBeVisible();
  await expect(nextInput).toHaveValue('next');
  await expect(doneInput).toHaveValue('done');

  await page.getByRole('button', { name: 'Back to tasks' }).click();
  await expect(
    page.getByText('Dictate several tasks hands-free. “next” starts a new entry; “done” finishes.'),
  ).toBeVisible();
});
