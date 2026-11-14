import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'next-env.d.ts', 'test-results/**', 'playwright-report/**', '.lighthouseci/**']),
]);
