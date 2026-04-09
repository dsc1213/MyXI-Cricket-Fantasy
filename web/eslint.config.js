import js from '@eslint/js'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'max-len': [
        'warn',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      'max-lines': [
        'warn',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['playwright.config.js', 'tests/e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unsafe-finally': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-unused-modules': [
        'warn',
        {
          unusedExports: true,
          missingExports: true,
          ignoreExports: ['src/main.jsx'],
        },
      ],
    },
  },
  {
    files: [
      'src/lib/api.js',
      'src/lib/jsonInput.js',
      'src/pages/Dashboard.jsx',
      'src/pages/FantasyHub.jsx',
      'src/pages/dashboard/AdminManagerPanel.jsx',
      'src/pages/dashboard/SquadManagerPanel.jsx',
    ],
    rules: {
      'max-lines': 'off',
      'no-misleading-character-class': 'off',
    },
  },
  prettier,
])
