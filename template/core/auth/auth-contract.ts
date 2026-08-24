export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

export type AuthAdapter = {
  signIn: (email: string, password: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
};

export function createMockAuthAdapter(): AuthAdapter {
  return {
    async signIn(email, password) {
      if (!email.trim() || password.length < 6) {
        throw new Error('Enter an email and a password with at least six characters.');
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      return {
        accessToken: `mock-${Date.now()}`,
        user: {
          id: 'mock-user',
          email: email.trim().toLowerCase(),
          displayName: email.split('@')[0] || 'User',
        },
      };
    },
    async signOut() {
      return Promise.resolve();
    },
  };
}
