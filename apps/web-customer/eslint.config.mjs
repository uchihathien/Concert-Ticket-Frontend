import config from '@nexaticket/config/eslint.next.mjs';

export default [
  // Thư mục build riêng của E2E.
  { ignores: ['.next-e2e/**'] },
  ...config,
];
