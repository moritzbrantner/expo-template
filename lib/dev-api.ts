export const DEV_API_URL = process.env.EXPO_PUBLIC_DEV_API_URL ?? 'http://localhost:4402';

export type ExampleProfile = {
  username: string;
  name: string;
  role: string;
  location: string;
  bio: string;
  about: string;
  interests: string[];
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

  return payload as ApiSuccessPayload<T>;
}

export async function fetchProfilesRequest() {
  const response = await fetch(`${DEV_API_URL}/profiles`);

  return parseResponse<ExampleProfile[]>(response);
}
