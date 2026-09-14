import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workspaceContract = spawnSync(
  process.execPath,
  ['scripts/check-mobile-workspace.ts'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
  },
);

test('mobile workspace contract is valid', () => {
  assert.equal(
    workspaceContract.status,
    0,
    [workspaceContract.stdout, workspaceContract.stderr]
      .filter(Boolean)
      .join('\n'),
  );
});
