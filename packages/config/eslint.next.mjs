// Cấu hình ESLint cho 4 app Next.js: base + react-hooks + luật của Next.
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import base from './eslint.base.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // `next-env.d.ts` do Next sinh lại mỗi lần build và không được commit — lint nó là vô nghĩa.
  { ignores: ['next-env.d.ts', '.next/**'] },
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
];
