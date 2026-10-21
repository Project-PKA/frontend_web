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
  // Prettier writes void elements as <input />, which the Vue style rule would flag.
  { files: ['**/*.vue'], rules: { 'vue/html-self-closing': ['warn', { html: { void: 'any' } }] } },
  {
    files: ['**/*.{ts,vue,mjs}'],
    ignores: ['app/api/**', 'e2e/**', 'e2e-real/**'],
    rules: { 'no-restricted-syntax': ['error', forbiddenTransport] },
  },
);
