import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  ...expoConfig,
  { ignores: ['.expo/**', 'dist/**'] },
  { files: ['jest.setup.cjs'], languageOptions: { globals: { jest: 'readonly' } } },
]);
