// @ts-check
import tseslint from 'typescript-eslint'
import { FlatCompat } from '@eslint/eslintrc'
import nxPlugin from '@nx/eslint-plugin'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default tseslint.config(
  // Fichiers ignorés globalement
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.nx/**',
      '**/payload-types.ts',
    ],
  },

  // Base TypeScript recommandé (strict)
  ...tseslint.configs.recommended,

  // Règles NX (boundaries entre libs/apps) — exclure les fichiers de config
  {
    plugins: { '@nx': nxPlugin },
    ignores: ['**/*.config.{mjs,js,cjs,ts}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
          ],
        },
      ],
    },
  },

  // Règles TypeScript communes à tout le projet
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },

  // Fichiers de config (next.config.js, eslint.config.mjs, etc.)
  {
    files: ['**/*.config.{js,mjs,cjs,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
)