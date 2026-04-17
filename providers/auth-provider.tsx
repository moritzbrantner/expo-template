import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { signInRequest, signUpRequest, updateUserAvatarRequest, type AuthUser } from '@/lib/auth';
import { clearPersistedSession, loadPersistedSession, persistSession } from '@/lib/auth-storage';

type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  currentUser: AuthUser | null;
  sessionToken: string | null;
  isHydrating: boolean;
  signUp: (input: SignUpInput) => Promise<{ message: string; user: AuthUser }>;
  signIn: (input: SignInInput) => Promise<AuthUser>;
  updateProfilePicture: (avatarDataUrl: string | null) => Promise<AuthUser>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const session = await loadPersistedSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        setCurrentUser(session.user);
        setSessionToken(session.token);
      }

      setIsHydrating(false);
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      sessionToken,
      isHydrating,
      async signUp(input) {
        const response = await signUpRequest(input);
        return response;
      },
      async signIn(input) {
        const response = await signInRequest(input);
        setCurrentUser(response.user);
        setSessionToken(response.token);
        await persistSession({
          token: response.token,
          user: response.user,
        });
        return response.user;
      },
      async updateProfilePicture(avatarDataUrl) {
        if (!currentUser) {
          throw new Error('Sign in to update your profile picture.');
        }

        const response = await updateUserAvatarRequest(currentUser.id, avatarDataUrl);
        setCurrentUser(response.user);

        if (sessionToken) {
          await persistSession({
            token: sessionToken,
            user: response.user,
          });
        }

        return response.user;
      },
      signOut() {
        setCurrentUser(null);
        setSessionToken(null);
        void clearPersistedSession();
      },
    }),
    [currentUser, isHydrating, sessionToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
