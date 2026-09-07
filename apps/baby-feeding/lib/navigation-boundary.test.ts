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

  assert.match(layout, /headerTitle: 'Feeding Log'/);
  assert.match(layout, /accessibilityLabel="Open stats"/);
  assert.match(layout, />📊</);
  assert.match(layout, /accessibilityLabel="Open settings"/);
  assert.match(layout, />⚙️</);
  assert.match(layout, /marginRight: 12/);
  assert.doesNotMatch(index, /BABY FEEDING|<Text style=\{styles\.heading\}>Feeding log/);
  assert.doesNotMatch(index, /Change setup|Current setup|Record only the feeding workflows/);
  assert.match(settings, /title: 'Breast milk'/);
  assert.match(settings, /title: 'Pumping'/);
  assert.match(settings, /title: 'Formula'/);
  assert.match(settings, /accessibilityRole="checkbox"/);
});

test('keeps historical stats on a dedicated page', () => {
  const layout = read('app/_layout.tsx');
  const index = read('app/index.tsx');
  const stats = read('app/stats.tsx');

  assert.doesNotMatch(index, /href="\/stats"/);
  assert.match(layout, /href="\/stats"/);
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
    /styles\.stepGroup\}>\s*<StepButton\s*icon="−−"\s*label="−10 ml"[\s\S]*?<StepButton\s*icon="−"\s*label="−5 ml"/,
  );
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton\s*icon="\+\+"\s*label="\+10 ml"[\s\S]*?<StepButton\s*icon="\+"\s*label="\+5 ml"/,
  );
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton\s*icon="↞"\s*label="−1 h"[\s\S]*?<StepButton\s*icon="‹"\s*label="−5 min"/,
  );
  assert.match(
    index,
    /styles\.stepGroup\}>\s*<StepButton\s*icon="↠"\s*label="\+1 h"[\s\S]*?<StepButton\s*icon="›"\s*label="\+5 min"/,
  );
});

test('keeps date controls contextual and centers Now between time directions', () => {
  const index = read('app/index.tsx');

  assert.match(index, /isEarlierLocalDay\(occurredAt, Date\.now\(\)\) \? \(/);
  assert.match(index, /accessibilityLabel="Set time to now"/);
  assert.match(index, /icon="◎"\s*label="Now"/);
  assert.match(
    index,
    /label="−5 min"[\s\S]*?accessibilityLabel="Set time to now"[\s\S]*?label="\+1 h"/,
  );
  assert.match(
    index,
    /timeStepRow: \{ flexDirection: 'row', alignItems: 'stretch', gap: 7, marginTop: 8 \}/,
  );
});

test('keeps history independently scrollable above a viewport-bottom recorder and record types on one row', () => {
  const index = read('app/index.tsx');
  const historyPosition = index.indexOf('contentContainerStyle={styles.historyContent}');
  const composerPosition = index.indexOf('contentContainerStyle={styles.composerContent}');

  assert.ok(historyPosition >= 0);
  assert.ok(composerPosition > historyPosition);
  assert.match(index, /<View style=\{styles\.screen\}>/);
  assert.match(index, /historyScroll: \{ flex: 1, minHeight: 0 \}/);
  assert.match(
    index,
    /composerScroll: \{[\s\S]*?flexGrow: 0,[\s\S]*?flexShrink: 1,[\s\S]*?maxHeight: '72%'/,
  );
  assert.doesNotMatch(index, /contentContainerStyle=\{styles\.content\}/);
  assert.match(index, /recordTypeRow: \{ flexDirection: 'row', gap: 8 \}/);
  assert.match(index, /<View style=\{styles\.recordTypeRow\}>/);
  assert.doesNotMatch(index, /recordTypeRow:[^\n]*flexWrap/);
});

test('keeps bottle-used compact and lets recording buttons use icons, text, or both', () => {
  const index = read('app/index.tsx');
  const settings = read('app/settings.tsx');

  assert.match(index, /<ChoiceButton\s*compact\s*icon="🍼"\s*label="Bottle used"/);
  assert.match(
    index,
    /choiceButtonCompact: \{[\s\S]*?flexGrow: 0,[\s\S]*?alignSelf: 'flex-start',[\s\S]*?minHeight: 44/,
  );
  assert.match(index, /presentation=\{buttonPresentation\}/);
  assert.match(settings, /value: 'icons', label: 'Icons'/);
  assert.match(settings, /value: 'text', label: 'Text'/);
  assert.match(settings, /value: 'icons-text', label: 'Icons \+ text'/);
});

test('keeps bottle and pumping-gear care on dedicated pages', () => {
  const layout = read('app/_layout.tsx');
  const settings = read('app/settings.tsx');
  const bottles = read('app/bottles.tsx');
  const pumpingGear = read('app/pumping-gear.tsx');
  const tracker = read('components/EquipmentTrackerScreen.tsx');

  assert.match(settings, /href="\/bottles"/);
  assert.match(settings, /href="\/pumping-gear"/);
  assert.match(layout, /name="bottles"/);
  assert.match(layout, /name="pumping-gear"/);
  assert.match(bottles, /kind="bottle"/);
  assert.match(pumpingGear, /kind="pump-kit"/);
  assert.match(tracker, /label: 'Dirty'/);
  assert.match(tracker, /label: 'Washed'/);
  assert.match(tracker, /label: 'Sterilized'/);
});
