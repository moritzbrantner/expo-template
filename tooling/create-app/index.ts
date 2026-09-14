import { generateApp, parsePreset } from './generator';

function argument(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  throw new Error('Usage: bun create-app <slug> --preset=utility [--output-root <directory>]');
}

const preset = parsePreset(argument('--preset'));
const outputRoot = argument('--output-root');
const { target } = generateApp({
  slug,
  preset,
  repositoryRoot: process.cwd(),
  outputRoot: outputRoot ?? process.cwd(),
});

console.log(`Created ${preset} app at ${target}`);
