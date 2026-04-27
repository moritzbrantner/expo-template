import { sortNavigationItems, type ShellNavigationCategory } from '@moritzbrantner/frontend-ui';
import { createNativeStackDescriptors, createNativeTabDescriptors } from '@moritzbrantner/frontend-ui/native';
import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';

import type { IconSymbol } from '@/components/ui/icon-symbol';

export type AppNavigationHref =
  | '/'
  | '/auth/sign-in'
  | '/auth/sign-up'
  | '/discover'
  | '/activity'
  | '/me'
  | '/settings'
  | '/settings/account';

type AppTabName = 'index' | 'discover' | 'activity' | 'me';
type AppTabIconName = ComponentProps<typeof IconSymbol>['name'];

export const appTabDescriptors = createNativeTabDescriptors<AppNavigationHref>([
  {
    key: 'social',
    label: 'Social',
    items: [
      {
        name: 'index',
        title: 'Home',
        iconName: 'house.fill' as AppTabIconName,
        href: '/' as const,
        order: 10,
      },
      {
        name: 'discover',
        title: 'Discover',
        iconName: 'magnifyingglass' as AppTabIconName,
        href: '/discover' as const,
        order: 20,
      },
      {
        name: 'activity',
        title: 'Activity',
        iconName: 'bell.fill' as AppTabIconName,
        href: '/activity' as const,
        order: 30,
      },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      {
        name: 'me',
        title: 'Me',
        iconName: 'person.crop.circle.fill' as AppTabIconName,
        href: '/me' as const,
        order: 40,
      },
    ],
  },
]) as Array<{
  name: AppTabName;
  title: string;
  iconName: AppTabIconName;
  href?: AppNavigationHref | null;
  groupKey: string;
  groupLabel: string;
  hidden?: boolean;
  order?: number;
}>;

export const protectedStackDescriptors = createNativeStackDescriptors([
  {
    name: '(tabs)',
    title: 'App',
    order: 10,
  },
  {
    name: 'settings/index',
    title: 'Settings',
    order: 20,
  },
  {
    name: 'settings/account',
    title: 'Account',
    order: 30,
  },
]);

export const publicStackDescriptors = createNativeStackDescriptors([
  {
    name: 'index',
    title: 'Overview',
    order: 10,
  },
  {
    name: 'auth',
    title: 'Authentication',
    order: 20,
  },
  {
    name: 'u/[username]',
    title: 'Profile',
    order: 30,
  },
]);

export const webNavigationCategories: ShellNavigationCategory[] = [
  {
    key: 'public',
    label: 'Public',
    items: sortNavigationItems([
      {
        key: 'overview',
        href: '/',
        label: 'Overview',
        order: 10,
      },
      {
        key: 'sign-in',
        href: '/auth/sign-in',
        label: 'Sign in',
        hotkey: 'G S',
        order: 20,
      },
      {
        key: 'create-account',
        href: '/auth/sign-up',
        label: 'Create account',
        hotkey: 'G C',
        order: 30,
      },
    ]),
  },
  {
    key: 'social',
    label: 'App',
    items: sortNavigationItems(
      appTabDescriptors.map((descriptor) => ({
        key: descriptor.name,
        href: descriptor.href ?? '/',
        label: descriptor.title,
        hotkey:
          descriptor.name === 'index'
            ? 'G H'
            : descriptor.name === 'discover'
              ? 'G D'
              : descriptor.name === 'activity'
                ? 'G A'
                : 'G M',
        order: descriptor.order,
      })),
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    items: sortNavigationItems([
      {
        key: 'settings-index',
        href: '/settings',
        label: 'Overview',
        order: 10,
      },
      {
        key: 'settings-account',
        href: '/settings/account',
        label: 'Account',
        order: 20,
      },
    ]),
  },
];

export const primaryCtas = [
  {
    key: 'sign-in',
    href: '/auth/sign-in' as Href,
    label: 'Sign in',
  },
  {
    key: 'sign-up',
    href: '/auth/sign-up' as Href,
    label: 'Create account',
  },
] as const;
