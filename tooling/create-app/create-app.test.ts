import { describe, expect, test } from 'bun:test';

import {
  buildCopierArgs,
  createAppPlan,
  parseCreateAppArgs,
  registerWorkspace,
} from './create-app';

describe('parseCreateAppArgs', () => {
  test('defaults to the smallest utility preset', () => {
    expect(parseCreateAppArgs(['reading-list'])).toEqual({
      slug: 'reading-list',
      appName: 'Reading List',
      preset: 'utility',
      navigation: 'stack',
      dryRun: false,
    });
  });

  test('maps standard to the local-first navigation baseline', () => {
    expect(
      parseCreateAppArgs([
        'field-notes',
        '--name',
        'Field Notes',
        '--preset',
        'standard',
      ]),
    ).toEqual({
      slug: 'field-notes',
      appName: 'Field Notes',
      preset: 'standard',
      navigation: 'tabs',
      dryRun: false,
    });
  });

  test('rejects speculative presets instead of silently broadening the contract', () => {
    expect(() => parseCreateAppArgs(['demo', '--preset', 'native'])).toThrow(
      'Use utility or standard',
    );
  });

  test('rejects unsafe or ambiguous workspace slugs', () => {
    for (const slug of ['BadName', 'two--hyphens', '../escape', 'trailing-']) {
      expect(() => parseCreateAppArgs([slug])).toThrow('Invalid app slug');
    }
  });
});

describe('createAppPlan', () => {
  test('maps public presets onto the canonical Copier profiles', () => {
    const utility = createAppPlan(parseCreateAppArgs(['utility-fixture']));
    const standard = createAppPlan(
      parseCreateAppArgs(['standard-fixture', '--preset', 'standard']),
    );

    expect(utility.profile).toBe('minimal');
    expect(standard.profile).toBe('local-first');
    expect(utility.packageName).toBe('@expo-template/utility-fixture');
    expect(standard.workspacePath).toBe('apps/standard-fixture');
  });

  test('passes package identity through Copier rather than rewriting generated files', () => {
    const plan = createAppPlan(
      parseCreateAppArgs(['fixture', '--name', 'Fixture', '--navigation', 'tabs']),
    );
    const args = buildCopierArgs(plan, '/repo', '/repo/apps/.create-fixture');

    expect(args).toContain('package_name=@expo-template/fixture');
    expect(args).toContain('profile=minimal');
    expect(args).toContain('navigation=tabs');
    expect(args.slice(-2)).toEqual(['/repo', '/repo/apps/.create-fixture']);
  });
});

describe('registerWorkspace', () => {
  test('adds a workspace once and keeps deterministic ordering', () => {
    const input = JSON.stringify(
      {
        name: 'mobile',
        workspaces: ['services/auth-api', 'apps/tasks'],
        private: true,
      },
      null,
      2,
    );

    const once = registerWorkspace(input, 'apps/habits');
    const twice = registerWorkspace(once, 'apps/habits');
    const parsed = JSON.parse(twice) as { workspaces: string[] };

    expect(parsed.workspaces).toEqual(['apps/habits', 'apps/tasks', 'services/auth-api']);
    expect(twice).toBe(once);
  });
});
