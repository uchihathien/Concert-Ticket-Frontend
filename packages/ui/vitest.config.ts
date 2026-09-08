import base from '@nexaticket/config/vitest.base.ts';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(base, {
  test: { setupFiles: ['./vitest.setup.ts'] },
});
