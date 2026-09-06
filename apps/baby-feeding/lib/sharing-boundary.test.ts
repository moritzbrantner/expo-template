import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));

function read(relativePath: string) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('shares through the public root route and keeps received state in one explicit query parameter', () => {
  const sharing = read('lib/sharing.ts');

  assert.match(sharing, /SHARE_BASE_URL = 'https:\/\/moritzbrantner\.github\.io\/expo-template\/baby-feeding\/'/);
  assert.match(sharing, /SHARE_QUERY_PARAM = 'state'/);
  assert.doesNotMatch(sharing, /fetch\(/);
});

test('documents that URL snapshots are readable by anyone with the link and are not live sync', () => {
  const screen = read('app/share.tsx');

  assert.match(screen, /encoded in the URL, not encrypted/);
  assert.match(screen, /point-in-time copy/);
  assert.match(screen, /Replace with shared state/);
  assert.match(screen, /Keep my local state/);
});
