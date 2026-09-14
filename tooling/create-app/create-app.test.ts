import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildCopierArgs,
  createAppPlan,
  parseCreateAppArgs,
  registerWorkspace,
} from './create-app';

describe('parseCreateAppArgs', () => {
  test('defaults to the smallest utility preset', () => {
    assert.deepEqual(parseCreateAppArgs(['reading-list']), {
      slug: 'reading-list',
      appName: 'Reading List',
      preset: 'utility',
      navigation: 'stack',
      dryRun: false,
    });
  });

  test('maps standard to the local-first navigation baseline', () => {
    assert.deepEqual(
      parseCreateAppArgs([
        'field-notes',
        '--name',
        'Field Notes',
        '--preset',
        'standard',
      ]),
      {
        slug: 'field-notes',
        appName: 'Field Notes',
        preset: 'standard',
        navigation: 'tabs',
        dryRun: false,
      },
    );
  });

  test('rejects speculative presets instead of silently broadening the contract', () => {
    assert.throws(
      () => parseCreateAppArgs(['demo', '--preset', 'native']),
      /Use utility or standard/,
    );
  });

  test('rejects unsafe or ambiguous workspace slugs', () => {
    for (const slug of ['BadName', 'two--hyphens', '../escape', 'trailing-']) {
      assert.throws(() => parseCreateAppArgs([slug]), /Invalid app slug/);
    }
  });
});

describe('createAppPlan', () => {
  test('maps public presets onto the canonical Copier profiles', () => {
    const utility = createAppPlan(parseCreateAppArgs(['utility-fixture']));
    const standard = createAppPlan(
      parseCreateAppArgs(['standard-fixture', '--preset', 'standard']),
    );

    assert.equal(utility.profile, 'minimal');
    assert.equal(standard.profile, 'local-first');
    assert.equal(utility.packageName, '@expo-template/utility-fixture');
    assert.equal(standard.workspacePath, 'apps/standard-fixture');
  });

  test('passes package identity through Copier rather than rewriting generated files', () => {
    const plan = createAppPlan(
      parseCreateAppArgs(['fixture', '--name', 'Fixture', '--navigation', 'tabs']),
    );
    const args = buildCopierArgs(plan, '/repo', '/repo/apps/.create-fixture');

    assert(args.includes('package_name=@expo-template/fixture'));
    assert(args.includes('profile=minimal'));
    assert(args.includes('navigation=tabs'));
    assert.deepEqual(args.slice(-2), ['/repo', '/repo/apps/.create-fixture']);
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

    assert.deepEqual(parsed.workspaces, ['apps/habits', 'apps/tasks', 'services/auth-api']);
    assert.equal(twice, once);
  });
});
