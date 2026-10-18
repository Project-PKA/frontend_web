import vuejsAccessibility from 'eslint-plugin-vuejs-accessibility';
import sonarjs from 'eslint-plugin-sonarjs';
import { withNuxt } from './.nuxt/eslint.config.mjs';

const forbiddenTransport = {
  selector: 'CallExpression[callee.name=/^(fetch|\\$fetch|useFetch|useLazyFetch)$/]',
  message: 'Network calls live only in app/api/. Use the API client.',
};

export default withNuxt(
  { ignores: ['design/**', 'app/api/generated.ts', 'coverage/**', '.output/**'] },
  ...vuejsAccessibility.configs['flat/recommended'],
  sonarjs.configs.recommended,
  {
    files: ['**/*.{ts,vue,mjs}'],
    ignores: ['app/api/**', 'e2e/**'],
    rules: { 'no-restricted-syntax': ['error', forbiddenTransport] },
  },
);
