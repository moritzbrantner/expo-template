import { createRequire } from 'node:module';

import { defineConfig } from 'eslint/config';

const require = createRequire(import.meta.url);
const expoConfig = require('eslint-config-expo/flat');

export default defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);
