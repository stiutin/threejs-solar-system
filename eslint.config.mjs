// @ts-check
import eslint from '@eslint/js';
import {defineConfig, globalIgnores} from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

/** House rules, shared by every project in the portfolio. Formatting itself is Prettier's job. */
const HOUSE_RULES = {
  'arrow-body-style': ['error', 'as-needed'],
  curly: ['error', 'all'],
  'no-console': ['error', {allow: ['warn', 'error']}],
  'simple-import-sort/exports': 'error',
  'simple-import-sort/imports': 'error',
  'unused-imports/no-unused-imports': 'error',
};

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'playwright-report/', 'test-results/']),
  eslint.configs.recommended,
  {
    languageOptions: {ecmaVersion: 'latest', globals: globals.browser, sourceType: 'module'},
    plugins: {'simple-import-sort': simpleImportSort, 'unused-imports': unusedImports},
    rules: {
      ...HOUSE_RULES,
      eqeqeq: 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },
  {
    // Node tooling: Playwright config, e2e tests, scripts. Command-line tools report progress on stdout.
    files: ['playwright.config.js', 'e2e/**', 'scripts/**'],
    languageOptions: {globals: globals.node},
    rules: {'no-console': 'off'},
  },
  eslintConfigPrettier
);
