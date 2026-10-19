import { cleanup } from '@testing-library/vue';
import { config } from '@vue/test-utils';
import { afterEach } from 'vitest';
import { h } from 'vue';

// `NuxtLink` is registered by Nuxt; in component tests it is a plain link.
const NuxtLink = Object.assign(
  (
    props: { to: string },
    { slots, attrs }: { slots: { default?: () => unknown }; attrs: Record<string, unknown> },
  ) => h('a', { ...attrs, href: props.to }, slots.default?.() as never),
  { props: ['to'] },
);
config.global.components = { NuxtLink };

afterEach(cleanup);
