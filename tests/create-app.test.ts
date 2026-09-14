import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';

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

    assert.deepEqual(first, second);
    const packageJson = JSON.parse(
      first.find(([path]) => path === 'package.json')?.[1] ?? '{}',
    ) as { name?: string; dependencies?: Record<string, string> };
    assert.equal(packageJson.name, '@expo-template/field-notes');
    assert.equal(packageJson.dependencies?.expo, rootPackage.dependencies.expo);
    assert.equal(
      packageJson.dependencies?.['expo-router'],
      rootPackage.dependencies['expo-router'],
    );
  });

  test('fails safely instead of overwriting an existing app', () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'create-app-'));
    generateApp({ slug: 'field-notes', preset: 'utility', outputRoot });

    assert.throws(
      () => generateApp({ slug: 'field-notes', preset: 'utility', outputRoot }),
      /Refusing to overwrite/,
    );
  });

  test('rejects slugs that are invalid package identities or URL schemes', () => {
    assert.throws(() => validateSlug('Field Notes'), /Invalid app slug/);
    assert.throws(() => validateSlug('123-notes'), /Invalid app slug/);
  });

  test('rejects unsupported presets', () => {
    assert.throws(() => parsePreset('standard'), /Unsupported preset/);
  });
});
