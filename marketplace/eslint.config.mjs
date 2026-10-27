import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      'app/protected/arbiter/[id]/arbiter-client.tsx',
      'app/protected/listings/[id]/buy/buy-client.tsx',
      'app/protected/orders/[id]/order-client.tsx',
      'app/protected/wallet/page.tsx',
      'components/theme-switcher.tsx',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    files: ['tailwind.config.ts', 'test-bitcoin.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
  ]),
]);
