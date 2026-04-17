import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchActivityRequest,
  fetchAdminUsersRequest,
  fetchProfileRequest,
  followProfileRequest,
  searchProfilesRequest,
  unfollowProfileRequest,
  updateUserRoleRequest,
  type AdminUser,
  type ProfileDetail,
  type PublicProfile,
  type Role,
} from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';

function clampCount(value: number) {
  return Math.max(0, value);
}

function applyFollowUpdateToPublicProfile(
  profile: PublicProfile,
  targetUsername: string,
  currentUsername: string | null,
  shouldFollow: boolean,
) {
  if (profile.username === targetUsername) {
    return {
      ...profile,
      followerCount: clampCount(profile.followerCount + (shouldFollow ? 1 : -1)),
      relationship: profile.relationship
        ? {
            ...profile.relationship,
            isFollowing: shouldFollow,
          }
        : {
            isFollowing: shouldFollow,
            isFollowedBy: false,
          },
    };
  }

  if (currentUsername && profile.username === currentUsername) {
    return {
      ...profile,
      followingCount: clampCount(profile.followingCount + (shouldFollow ? 1 : -1)),
    };
  }

  return profile;
}

function applyFollowUpdateToProfileDetail(
  profile: ProfileDetail,
  targetUsername: string,
  currentUsername: string | null,
  shouldFollow: boolean,
) {
  const updatedProfile = applyFollowUpdateToPublicProfile(
    profile,
    targetUsername,
    currentUsername,
    shouldFollow,
  );

  return {
    ...profile,
    ...updatedProfile,
  };
}

export function useDiscoverProfiles(query: string) {
  return useQuery({
    queryKey: ['profiles', query],
    queryFn: () => searchProfilesRequest({ query }),
  });
}

export function useProfileQuery(username: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', username],
    enabled: Boolean(username),
    queryFn: () => fetchProfileRequest(String(username)),
  });
}

export function useActivityQuery() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivityRequest,
  });
}

export function useAdminUsersQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'users'],
    enabled,
    queryFn: fetchAdminUsersRequest,
  });
}

export function useFollowMutation(username: string) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (shouldFollow: boolean) => {
      if (shouldFollow) {
        return followProfileRequest(username);
      }

      await unfollowProfileRequest(username);
      return null;
    },
    onMutate: async (shouldFollow) => {
      const currentUsername = currentUser?.username ?? null;
      const profileQueries = queryClient.getQueriesData<{ profile: ProfileDetail }>({
        queryKey: ['profile'],
      });
      const profilesQueries = queryClient.getQueriesData<{ profiles: PublicProfile[]; nextCursor: string | null }>({
        queryKey: ['profiles'],
      });

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['profile'] }),
        queryClient.cancelQueries({ queryKey: ['profiles'] }),
      ]);

      for (const [queryKey, data] of profileQueries) {
        if (!data) {
          continue;
        }

        queryClient.setQueryData(queryKey, {
          profile: applyFollowUpdateToProfileDetail(
            data.profile,
            username,
            currentUsername,
            shouldFollow,
          ),
        });
      }

      for (const [queryKey, data] of profilesQueries) {
        if (!data) {
          continue;
        }

        queryClient.setQueryData(queryKey, {
          ...data,
          profiles: data.profiles.map((profile) =>
            applyFollowUpdateToPublicProfile(profile, username, currentUsername, shouldFollow),
          ),
        });
      }

      return {
        profileQueries,
        profilesQueries,
      };
    },
    onError: (_error, _shouldFollow, context) => {
      for (const [queryKey, data] of context?.profileQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context?.profilesQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', username] }),
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
      ]);
    },
  });
}

export function useRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => updateUserRoleRequest(userId, role),
    onSuccess: (result) => {
      queryClient.setQueryData<{ users: AdminUser[] }>(['admin', 'users'], (current) => {
        if (!current) {
          return current;
        }

        return {
          users: current.users.map((user) => (user.id === result.user.id ? result.user : user)),
        };
      });
    },
  });
}
