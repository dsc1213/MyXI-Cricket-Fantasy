import js from '@eslint/js'
import globals from 'globals'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['node_modules']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
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
    },
  },
  {
    files: [
      'mocks/**/*.js',
      'tests/**/*.js',
      'src/services/mockRoutes.service.js',
      'src/services/mockProviderContext.service.js',
      'src/routes/coreRoutes.js',
    ],
    rules: {
      'max-lines': 'off',
    },
  },
  prettier,
])
