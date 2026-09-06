import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));

function read(relativePath: string) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('keeps feeding-method configuration behind the settings gear', () => {
  const layout = read('app/_layout.tsx');
  const index = read('app/index.tsx');
  const settings = read('app/settings.tsx');

  assert.match(layout, /accessibilityLabel="Open settings"/);
  assert.match(layout, />⚙</);
  assert.doesNotMatch(index, /Change setup|Current setup|Record only the feeding workflows/);
  assert.match(settings, /title: 'Breast milk'/);
  assert.match(settings, /title: 'Pumping'/);
  assert.match(settings, /title: 'Formula'/);
  assert.match(settings, /accessibilityRole="checkbox"/);
});

test('keeps historical stats on a dedicated page', () => {
  const index = read('app/index.tsx');
  const stats = read('app/stats.tsx');

  assert.match(index, /href="\/stats"/);
  assert.match(stats, /Last 7 days/);
  assert.match(stats, /Measured intake/);
  assert.match(stats, /Pumping/);
  assert.match(stats, /does not invent a milk volume/);
});

test('groups four-step adjustments into decrease and increase flex pairs', () => {
  const index = read('app/index.tsx');

  assert.match(index, /stepRow: \{ flexDirection: 'row', gap: 7, marginTop: 8 \}/);
  assert.match(index, /stepGroup: \{ flex: 1, flexDirection: 'row', gap: 7, minWidth: 0 \}/);
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton label="−10 ml"[\s\S]*?<StepButton label="−5 ml"/,
  );
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton label="\+10 ml"[\s\S]*?<StepButton label="\+5 ml"/,
  );
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton\s*label="−1 h"[\s\S]*?<StepButton\s*label="−5 min"/,
  );
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton\s*label="\+1 h"[\s\S]*?<StepButton\s*label="\+5 min"/,
  );
});
