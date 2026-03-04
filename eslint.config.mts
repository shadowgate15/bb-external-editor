import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import css from '@eslint/css'
import { defineConfig } from 'eslint/config'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
    ...pluginReact.configs.flat.recommended,
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
    ...pluginReact.configs.flat['jsx-runtime'],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.json'],
    ignores: ['**/tsconfig.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.jsonc', '**/tsconfig.json'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },
  { files: ['**/*.json5'], plugins: { json }, language: 'json/json5', extends: ['json/recommended'] },
  { files: ['**/*.md'], plugins: { markdown }, language: 'markdown/gfm', extends: ['markdown/recommended'] },
  { files: ['**/*.css'], plugins: { css }, language: 'css/css', extends: ['css/recommended'] },
  eslintPluginPrettierRecommended,
])
