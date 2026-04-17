import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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

async function createUser(
  request: APIRequestContext,
  input: {
    displayName: string;
    username: string;
    email: string;
    password?: string;
  },
) {
  const response = await request.post(`${AUTH_API_URL}/auth/signup`, {
    data: {
      password: 'password123',
      ...input,
    },
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function signInThroughUi(page: Page, email: string) {
  await page.goto('/auth/sign-in');
  await page.getByTestId('signin-email-input').fill(email);
  await page.getByTestId('signin-password-input').fill('password123');
  await page.getByTestId('signin-submit-button').click();
  await expect(page).toHaveURL('/');
}

test.describe('scaffold smoke/auth contract', () => {
  test.describe.configure({ mode: 'serial' });

  test('guest opening a protected tab is redirected to sign-in', async ({ page }) => {
    await resetAuthState();

    await page.goto('/discover');
    await expect(page).toHaveURL(/\/auth\/sign-in(\?|$)/);
  });

  test('signup creates an account and sends a welcome email', async ({ page }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const email = `signup-${uniqueId}@example.test`;

    await page.goto('/auth/sign-up');
    await page.getByTestId('signup-display-name-input').fill('Ada Lovelace');
    await page.getByTestId('signup-username-input').fill(`ada_${uniqueId}`);
    await page.getByTestId('signup-email-input').fill(email);
    await page.getByTestId('signup-password-input').fill('password123');
    await page.getByTestId('signup-confirm-password-input').fill('password123');
    await page.getByTestId('signup-submit-button').click();

    await expect(page).toHaveURL(/\/auth\/sign-in(\?|$)/);
    await expect(page.getByTestId('signin-success-message')).toContainText(
      'Account created. Sign in to continue.',
    );
    await expect(page.getByTestId('signin-email-input')).toHaveValue(email);
    await waitForWelcomeEmail(email);
  });

  test('session persists across reload and clears after sign out', async ({ page, request }) => {
    await resetAuthState();

    const email = `persisted-${Date.now()}@example.test`;
    await createUser(request, {
      displayName: 'Persistent User',
      username: `persisted_${Date.now()}`,
      email,
    });

    await signInThroughUi(page, email);
    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      `Signed in as ${email}`,
    );

    await page.reload();
    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      `Signed in as ${email}`,
    );

    await page.locator('[data-testid="signout-button"]:visible').click();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    await page.reload();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });

  test('social flow covers account edit, discover, follow, activity, sign out, and sign back in', async ({
    page,
    request,
  }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const memberEmail = `member-${uniqueId}@example.test`;
    const otherEmail = `other-${uniqueId}@example.test`;

    await createUser(request, {
      displayName: 'Member User',
      username: `member_${uniqueId}`,
      email: memberEmail,
    });
    const otherUser = await createUser(request, {
      displayName: 'Other User',
      username: `other_${uniqueId}`,
      email: otherEmail,
    });

    await signInThroughUi(page, memberEmail);

    await page.goto('/settings/account');
    await page.getByTestId('account-display-name-input').fill('Member User Updated');
    await page.getByTestId('account-username-input').fill(`member_${uniqueId}`);
    await page.getByTestId('account-bio-input').fill('I am testing the social shell.');
    await page.getByTestId('account-save-button').click();
    await expect(page.getByText('Profile updated.')).toBeVisible();

    await page.goto('/discover');
    const otherRow = page.getByTestId(`discover-user-${otherUser.user.username}`);
    await expect(otherRow).toContainText('Other User');
    await page.getByRole('button', { name: 'Follow' }).first().click();

    await page.goto('/activity');
    await expect(page.getByText(`You followed @${otherUser.user.username}`)).toBeVisible();

    await page.goto('/');
    await page.getByTestId('signout-button').click();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    await signInThroughUi(page, memberEmail);
    await expect(page.locator('[data-testid="session-status"]:visible')).toContainText(
      `Signed in as ${memberEmail}`,
    );
  });

  test('guest follow action from a public profile routes to sign-in', async ({ page, request }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const profile = await createUser(request, {
      displayName: 'Public User',
      username: `public_${uniqueId}`,
      email: `public-${uniqueId}@example.test`,
    });

    await page.goto(`/u/${profile.user.username}`);
    await page.getByTestId('profile-follow-button').click();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });

  test('admin can manage roles and members are redirected away from admin settings', async ({
    page,
    request,
  }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const adminEmail = 'admin@example.test';
    const memberEmail = `member-admin-${uniqueId}@example.test`;

    await createUser(request, {
      displayName: 'Admin User',
      username: `admin_${uniqueId}`,
      email: adminEmail,
    });
    const managedMember = await createUser(request, {
      displayName: 'Managed Member',
      username: `managed_${uniqueId}`,
      email: memberEmail,
    });

    await signInThroughUi(page, memberEmail);
    await page.goto('/settings/admin');
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByTestId('signout-button').click();

    await signInThroughUi(page, adminEmail);
    await page.goto('/settings/admin');
    await expect(page.getByText(memberEmail)).toBeVisible();
    await page.getByRole('button', { name: 'moderator' }).last().click();
    await expect(page.getByTestId(`admin-role-${managedMember.user.id}`)).toContainText(
      'Current role: moderator',
    );
  });

  test('theme mode persists across reload on web', async ({ page, request }) => {
    await resetAuthState();

    const uniqueId = Date.now();
    const email = `theme-${uniqueId}@example.test`;

    await createUser(request, {
      displayName: 'Theme User',
      username: `theme_${uniqueId}`,
      email,
    });

    await signInThroughUi(page, email);
    await page.goto('/settings');
    await page.getByTestId('theme-mode-dark').click();
    await expect(page.getByTestId('theme-mode-status')).toContainText('Saved preference: Dark');

    await page.reload();

    await expect(page.getByTestId('theme-mode-status')).toContainText('Saved preference: Dark');
  });
});
