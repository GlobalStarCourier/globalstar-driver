const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'web-build/**', '.expo/**', '.husky/_/**'],
  },
  {
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', '.']],
          extensions: ['.js', '.jsx', '.json'],
        },
      },
    },
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
