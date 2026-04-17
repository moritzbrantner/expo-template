import type { PropsWithChildren, ReactNode } from 'react';

import type { Permission } from '@/shared/social';
import { hasPermission as checkPermission } from '@/shared/social';
import { useAuth } from '@/providers/auth-provider';

export function hasPermission(permission: Permission, user: Parameters<typeof checkPermission>[0]) {
  return checkPermission(user, permission);
}

export function RequirePermission({
  permission,
  fallback = null,
  children,
}: PropsWithChildren<{
  permission: Permission;
  fallback?: ReactNode;
}>) {
  const { currentUser } = useAuth();

  if (!checkPermission(currentUser, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
