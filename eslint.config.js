const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'web-build/**', '.expo/**', '.husky/_/**'],
  },
  {
    languageOptions: {
      globals: {
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
]);
