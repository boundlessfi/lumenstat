import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // `server-only` throws outside a React Server Component build. The modules
    // it guards are plain Node code, so tests swap it for an empty module.
    alias: { 'server-only': fileURLToPath(new URL('./tests/unit/server-only.stub.ts', import.meta.url)) },
  },
});
