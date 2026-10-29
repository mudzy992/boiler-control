// @ts-check
// FE2-16: frontend nije imao ESLint konfiguraciju, pa je `npm run lint`
// zavrsavao s exit 2 ("ESLint looked for configuration files ... found none").
// Format je flat config, uskladjen s backend/eslint.config.mjs.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'eslint.config.mjs'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      // React 17+ JSX transform (vite @vitejs/plugin-react) — eksplicitni
      // `import React` vise nije potreban.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Tipovi su u TypeScriptu, propTypes su suvisni.
      'react/prop-types': 'off',

      // Stvarne greske — pravila hookova su najvrijednija provjera za React.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Bazno pravilo ne razumije TS tipove; koristi TS verziju.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Dokumentovane iznimke (FE2-16 kriterij: "Broj novonalaženja; iznimke
    // dokumentovane"). Sve su postavljene na 'warn' ili 'off' jer bi
    // ispravljanje postojeceg koda izaslo izvan obima quick win-a.
    rules: {
      // `any` je u postojecem kodu rasireno (npr. DashboardPage `items: any[]`).
      // Uskladjen s backend/eslint.config.mjs gdje je takodjer 'off'.
      '@typescript-eslint/no-explicit-any': 'off',
      // Upozorenja, ne greske: koristan signal za refaktor, ali ne rusi build.
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-case-declarations': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      'no-async-promise-executor': 'warn',
      'no-constant-condition': ['warn', { checkLoops: false }],
    },
  },
);
