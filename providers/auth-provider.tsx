import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  ApiRequestError,
  configureApiClient,
  fetchSessionRequest,
  signInRequest,
  signOutRequest,
  signUpRequest,
  updateMyAvatarRequest,
  updateMyProfileRequest,
  type Permission,
  type ProfileDetail,
  type SessionUser,
} from '@/lib/auth';
import { clearPersistedSession, loadPersistedSessionToken, persistSessionToken } from '@/lib/auth-storage';
import {
  bootstrapDevelopmentSession,
  shouldEnableDevelopmentSessionBootstrap,
} from '@/lib/dev-auth';
import { hasPermission as checkPermission } from '@/shared/social';

type SignUpInput = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type UpdateProfileInput = {
  displayName: string;
  username: string;
  bio: string;
};

type AuthContextValue = {
  currentUser: SessionUser | null;
  sessionToken: string | null;
  isHydrating: boolean;
  signUp: (input: SignUpInput) => Promise<{ message: string; user: SessionUser }>;
  signIn: (input: SignInInput) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<ProfileDetail>;
  updateProfilePicture: (avatarDataUrl: string | null) => Promise<ProfileDetail>;
  hasPermission: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [isBootstrappingDevelopmentSession, setIsBootstrappingDevelopmentSession] = useState(false);
  const hasAttemptedDevelopmentBootstrapRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreToken() {
      const token = await loadPersistedSessionToken();

      if (!isMounted) {
        return;
      }

      setSessionToken(token);
      setIsStorageReady(true);
    }

    void restoreToken();

    return () => {
      isMounted = false;
    };
  }, []);

  async function clearLocalSession() {
    setSessionToken(null);
    await clearPersistedSession();
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return key === 'activity' || key === 'profiles' || key === 'profile' || key === 'admin' || key === 'session';
      },
    });
  }

  useEffect(() => {
    configureApiClient({
      getToken: () => sessionToken,
      onUnauthorized: () => {
        void clearLocalSession();
      },
    });
  }, [queryClient, sessionToken]);

  const sessionQuery = useQuery({
    queryKey: ['session', sessionToken],
    enabled: isStorageReady && Boolean(sessionToken),
    retry: false,
    queryFn: fetchSessionRequest,
  });

  useEffect(() => {
    if (!(sessionQuery.error instanceof ApiRequestError) || sessionQuery.error.status !== 401) {
      return;
    }

    void clearLocalSession();
  }, [sessionQuery.error]);

  const currentUser = sessionQuery.data?.user ?? null;

  useEffect(() => {
    if (!isStorageReady || sessionToken || hasAttemptedDevelopmentBootstrapRef.current) {
      return;
    }

    if (!shouldEnableDevelopmentSessionBootstrap()) {
      hasAttemptedDevelopmentBootstrapRef.current = true;
      return;
    }

    hasAttemptedDevelopmentBootstrapRef.current = true;
    let isMounted = true;

    async function restoreDevelopmentSession() {
      setIsBootstrappingDevelopmentSession(true);

      try {
        const response = await bootstrapDevelopmentSession();

        if (!isMounted) {
          return;
        }

        setSessionToken(response.token);
        await persistSessionToken(response.token);
        queryClient.setQueryData(['session', response.token], {
          user: response.user,
        });
      } catch (error) {
        console.warn('Failed to bootstrap a development session.', error);
      } finally {
        if (isMounted) {
          setIsBootstrappingDevelopmentSession(false);
        }
      }
    }

    void restoreDevelopmentSession();

    return () => {
      isMounted = false;
    };
  }, [isStorageReady, queryClient, sessionToken]);

  const isHydrating =
    !isStorageReady || isBootstrappingDevelopmentSession || (!!sessionToken && sessionQuery.isPending);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      sessionToken,
      isHydrating,
      async signUp(input) {
        return signUpRequest(input);
      },
      async signIn(input) {
        const response = await signInRequest(input);
        setSessionToken(response.token);
        await persistSessionToken(response.token);
        queryClient.setQueryData(['session', response.token], {
          user: response.user,
        });
        return response.user;
      },
      async signOut() {
        try {
          await signOutRequest();
        } catch {
          // Local cleanup is still the source of truth for the app shell.
        }

        await clearLocalSession();
      },
      async updateProfile(input) {
        const response = await updateMyProfileRequest(input);

        if (sessionToken) {
          queryClient.setQueryData(['session', sessionToken], {
            user: response.user,
          });
        }

        queryClient.setQueryData(['profile', response.profile.username], {
          profile: response.profile,
        });
        return response.profile;
      },
      async updateProfilePicture(avatarDataUrl) {
        const response = await updateMyAvatarRequest(avatarDataUrl);

        if (sessionToken) {
          queryClient.setQueryData(['session', sessionToken], {
            user: response.user,
          });
        }

        queryClient.setQueryData(['profile', response.profile.username], {
          profile: response.profile,
        });
        return response.profile;
      },
      hasPermission(permission) {
        return checkPermission(currentUser, permission);
      },
    }),
    [currentUser, isHydrating, queryClient, sessionToken],
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
