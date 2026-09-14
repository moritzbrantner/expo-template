import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PackageJson = {
  name?: string;
  private?: boolean;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const readPackage = (path: string): PackageJson =>
  JSON.parse(readFileSync(path, "utf8")) as PackageJson;

const root = readPackage("package.json");
const errors: string[] = [];
const requiredWorkspaces = ["apps/*", "packages/*", "services/auth-api"];

for (const workspace of requiredWorkspaces) {
  if (!root.workspaces?.includes(workspace)) {
    errors.push(`root package.json must include workspace ${workspace}`);
  }
}

const appEntries = readdirSync("apps", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name));
const packageNames = new Map<string, string>();
const runtimeDependencies = ["expo", "expo-router", "react", "react-native"] as const;

for (const entry of appEntries) {
  const packagePath = join("apps", entry.name, "package.json");
  if (!existsSync(packagePath)) {
    errors.push(`${entry.name}: missing package.json`);
    continue;
  }

  const app = readPackage(packagePath);
  const expectedName = `@expo-template/${entry.name}`;

  if (app.name !== expectedName) {
    errors.push(`${entry.name}: package name must be ${expectedName}, got ${app.name ?? "<missing>"}`);
  }
  if (app.private !== true) {
    errors.push(`${entry.name}: portfolio apps must remain private workspace packages`);
  }

  if (app.name) {
    const previous = packageNames.get(app.name);
    if (previous) {
      errors.push(`${entry.name}: duplicate package name ${app.name}, already used by ${previous}`);
    } else {
      packageNames.set(app.name, entry.name);
    }
  }

  for (const dependency of runtimeDependencies) {
    const expected = root.dependencies?.[dependency];
    const actual = app.dependencies?.[dependency];
    if (!expected || actual !== expected) {
      errors.push(`${entry.name}: ${dependency} must match root ${expected ?? "<missing>"}, got ${actual ?? "<missing>"}`);
    }
  }

  const expectedTypeScript = root.devDependencies?.typescript;
  const actualTypeScript = app.devDependencies?.typescript;
  if (!expectedTypeScript || actualTypeScript !== expectedTypeScript) {
    errors.push(`${entry.name}: typescript must match root ${expectedTypeScript ?? "<missing>"}, got ${actualTypeScript ?? "<missing>"}`);
  }

  if (existsSync(join("apps", entry.name, "bun.lock"))) {
    errors.push(`${entry.name}: app-local bun.lock competes with the authoritative root lockfile`);
  }
}

if (errors.length > 0) {
  console.error("Mobile workspace contract failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Mobile workspace contract passed for ${appEntries.length} apps.`);
