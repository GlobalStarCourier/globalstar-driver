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
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js', 'jest.setup.js'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        test: 'readonly',
      },
    },
  },
]);
