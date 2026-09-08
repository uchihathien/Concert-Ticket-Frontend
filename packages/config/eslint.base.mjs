// Cấu hình ESLint dùng chung cho các package không phải Next.js.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Hai luật cứng của plan/frontend.md §4, ép bằng lint chứ không bằng lời nhắc:
      // access token chỉ nằm trong memory, không bao giờ chạm storage của trình duyệt.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Access token không được chạm localStorage (plan §4).' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'Access token không được chạm localStorage (plan §4).',
        },
      ],
    },
  },
];
