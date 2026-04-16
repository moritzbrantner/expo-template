const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function addCandidate(candidates, candidate) {
  if (!candidate) {
    return;
  }

  const resolvedCandidate = path.resolve(candidate);

  if (!candidates.includes(resolvedCandidate) && isExecutable(resolvedCandidate)) {
    candidates.push(resolvedCandidate);
  }
}

function collectNvmCandidates(candidates) {
  const homeDirectory = os.homedir();
  const nvmVersionsDirectory = path.join(homeDirectory, '.nvm', 'versions', 'node');

  if (!fs.existsSync(nvmVersionsDirectory)) {
    return;
  }

  const versionDirectories = fs
    .readdirSync(nvmVersionsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const versionDirectory of versionDirectories) {
    addCandidate(candidates, path.join(nvmVersionsDirectory, versionDirectory, 'bin', 'node'));
  }
}

function resolveNodeBinary() {
  const candidates = [];
  const currentBinary = process.execPath;
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);

  if (process.release?.name === 'node' && !process.versions?.bun) {
    addCandidate(candidates, currentBinary);
  }

  addCandidate(candidates, process.env.NVM_BIN ? path.join(process.env.NVM_BIN, 'node') : null);
  addCandidate(candidates, '/usr/bin/node');
  addCandidate(candidates, '/usr/local/bin/node');

  for (const pathEntry of pathEntries) {
    if (pathEntry.includes('/tmp/bun-node-') || pathEntry.endsWith('/.bun/bin')) {
      continue;
    }

    addCandidate(candidates, path.join(pathEntry, 'node'));
  }

  collectNvmCandidates(candidates);

  return candidates[0] ?? null;
}

const nodeBinary = resolveNodeBinary();
const testTargets = process.argv.slice(2);

if (!nodeBinary) {
  console.error('Unable to find a real Node.js binary to run node:test.');
  process.exit(1);
}

const result = spawnSync(nodeBinary, ['--test', ...testTargets], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
