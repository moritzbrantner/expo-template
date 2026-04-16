export const AUTH_API_URL = process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'http://localhost:4401';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type ApiErrorPayload = {
  error?: string;
};

type ApiSuccessPayload<T> = T & {
  error?: never;
};

async function parseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | ApiSuccessPayload<T> | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'The request could not be completed.');
  }

  return (payload ?? {}) as ApiSuccessPayload<T>;
}

export async function signUpRequest(input: { name: string; email: string; password: string }) {
  const response = await fetch(`${AUTH_API_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return parseResponse<{
    message: string;
    user: AuthUser;
  }>(response);
}

export async function signInRequest(input: { email: string; password: string }) {
  const response = await fetch(`${AUTH_API_URL}/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return parseResponse<{
    token: string;
    user: AuthUser;
  }>(response);
}

export async function fetchUsersRequest() {
  const response = await fetch(`${AUTH_API_URL}/users`);

  return parseResponse<{
    users: AuthUser[];
  }>(response);
}

export async function fetchUserRequest(userId: string) {
  const response = await fetch(`${AUTH_API_URL}/users/${userId}`);

  return parseResponse<{
    user: AuthUser;
  }>(response);
}
