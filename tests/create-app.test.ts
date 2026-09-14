import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildUtilityAppFiles,
  generateApp,
  parsePreset,
  validateSlug,
} from '../tooling/create-app/generator';

const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('create-app utility preset', () => {
  test('derives deterministic output from the canonical root contract', () => {
    const first = [...buildUtilityAppFiles('field-notes', rootPackage)];
    const second = [...buildUtilityAppFiles('field-notes', rootPackage)];

    expect(first).toEqual(second);
    const packageJson = JSON.parse(
      first.find(([path]) => path === 'package.json')?.[1] ?? '{}',
    ) as { name?: string; dependencies?: Record<string, string> };
    expect(packageJson.name).toBe('@expo-template/field-notes');
    expect(packageJson.dependencies?.expo).toBe(rootPackage.dependencies.expo);
    expect(packageJson.dependencies?.['expo-router']).toBe(
      rootPackage.dependencies['expo-router'],
    );
  });

  test('fails safely instead of overwriting an existing app', () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'create-app-'));
    generateApp({ slug: 'field-notes', preset: 'utility', outputRoot });

    expect(() =>
      generateApp({ slug: 'field-notes', preset: 'utility', outputRoot }),
    ).toThrow('Refusing to overwrite');
  });

  test('rejects invalid slugs and unsupported presets', () => {
    expect(() => validateSlug('Field Notes')).toThrow('Invalid app slug');
    expect(() => parsePreset('standard')).toThrow('Unsupported preset');
  });
});
