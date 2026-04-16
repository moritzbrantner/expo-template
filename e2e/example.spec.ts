import { expect, test } from '@playwright/test';

const AUTH_API_URL = 'http://127.0.0.1:4401';
const MAILPIT_API_URL = 'http://127.0.0.1:8825/api/v1/messages';

type MailpitMessage = {
  Subject?: string;
  To?: Array<{
    Address?: string;
  }>;
};

async function resetAuthState() {
  await fetch(`${AUTH_API_URL}/test/reset`, {
    method: 'POST',
  });
}

async function listMessages() {
  const response = await fetch(`${MAILPIT_API_URL}?limit=200`);
  const payload = (await response.json()) as { messages?: MailpitMessage[] };
  return payload.messages ?? [];
}

async function waitForWelcomeEmail(email: string) {
  return expect
    .poll(async () => {
      const messages = await listMessages();
      return messages.find((message) => {
        const recipient = message.To?.some((entry) => entry.Address === email);
        return recipient && message.Subject === 'Welcome to the Expo auth flow';
      });
    })
    .toBeTruthy();
}

test.describe('authentication', () => {
  test.describe.configure({ mode: 'serial' });

  test('signup creates an account and sends a welcome email', async ({ page }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const email = `signup-${uniqueId}@example.test`;

    await page.goto('/auth/sign-up');
    await page.getByTestId('signup-name-input').fill('Ada Lovelace');
    await page.getByTestId('signup-email-input').fill(email);
    await page.getByTestId('signup-password-input').fill('password123');
    await page.getByTestId('signup-confirm-password-input').fill('password123');
    await page.getByTestId('signup-submit-button').click();

    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.getByTestId('signin-success-message')).toContainText(
      'Account created. Sign in to continue.',
    );
    await expect(page.getByTestId('signin-email-input')).toHaveValue(email);
    await waitForWelcomeEmail(email);
  });

  test('signin creates a session that is visible on the home screen', async ({ page, request }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const email = `signin-${uniqueId}@example.test`;

    const signUpResponse = await request.post(`${AUTH_API_URL}/auth/signup`, {
      data: {
        name: 'Grace Hopper',
        email,
        password: 'password123',
      },
    });

    expect(signUpResponse.ok()).toBeTruthy();

    await page.goto('/auth/sign-in');
    await page.getByTestId('signin-email-input').fill(email);
    await page.getByTestId('signin-password-input').fill('password123');
    await page.getByTestId('signin-submit-button').click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      `Signed in as ${email}`,
    );
    await expect(page.locator('[data-testid="signout-button"]:visible')).toBeVisible();
  });

  test('session persists after reload and clears after sign out', async ({ page, request }) => {
    await resetAuthState();

    const email = `persisted-${Date.now()}@example.test`;

    const signUpResponse = await request.post(`${AUTH_API_URL}/auth/signup`, {
      data: {
        name: 'Persistent User',
        email,
        password: 'password123',
      },
    });

    expect(signUpResponse.ok()).toBeTruthy();

    await page.goto('/auth/sign-in');
    await page.getByTestId('signin-email-input').fill(email);
    await page.getByTestId('signin-password-input').fill('password123');
    await page.getByTestId('signin-submit-button').click();

    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      `Signed in as ${email}`,
    );

    await page.reload();

    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      `Signed in as ${email}`,
    );

    await page.locator('[data-testid="signout-button"]:visible').click();
    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      'No active session.',
    );

    await page.reload();

    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      'No active session.',
    );
  });

  test('duplicate signup shows the backend conflict error', async ({ page, request }) => {
    await resetAuthState();

    const email = `duplicate-${Date.now()}@example.test`;

    const firstResponse = await request.post(`${AUTH_API_URL}/auth/signup`, {
      data: {
        name: 'First User',
        email,
        password: 'password123',
      },
    });

    expect(firstResponse.ok()).toBeTruthy();

    await page.goto('/auth/sign-up');
    await page.getByTestId('signup-name-input').fill('Second User');
    await page.getByTestId('signup-email-input').fill(email);
    await page.getByTestId('signup-password-input').fill('password123');
    await page.getByTestId('signup-confirm-password-input').fill('password123');
    await page.getByTestId('signup-submit-button').click();

    await expect(page.getByTestId('signup-error-message')).toContainText(
      'An account already exists for this email address.',
    );
  });

  test('invalid signin shows an authentication error', async ({ page, request }) => {
    await resetAuthState();

    const email = `invalid-signin-${Date.now()}@example.test`;

    const signUpResponse = await request.post(`${AUTH_API_URL}/auth/signup`, {
      data: {
        name: 'Grace Hopper',
        email,
        password: 'password123',
      },
    });

    expect(signUpResponse.ok()).toBeTruthy();

    await page.goto('/auth/sign-in');
    await page.getByTestId('signin-email-input').fill(email);
    await page.getByTestId('signin-password-input').fill('wrong-password');
    await page.getByTestId('signin-submit-button').click();

    await expect(page.getByTestId('signin-error-message')).toContainText(
      'Invalid email or password.',
    );
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
