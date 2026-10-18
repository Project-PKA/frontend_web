<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    /** Full width. */
    block?: boolean;
    /** Square button with an icon only: `label` becomes its accessible name. */
    icon?: boolean;
    /** Accessible name of an icon-only button. */
    label?: string;
    type?: 'button' | 'submit' | 'reset';
    /** A route: renders a link that looks like a button. */
    to?: string;
    /** A request is running: the button cannot be used again meanwhile. */
    busy?: boolean;
    disabled?: boolean;
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', label: undefined, to: undefined },
);

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  props.size !== 'md' && `btn--${props.size}`,
  props.block && 'btn--block',
  props.icon && 'btn--icon',
]);

const unavailable = computed(() => props.disabled === true || props.busy === true);

if (import.meta.dev && props.icon && !props.label) {
  console.warn('AppButton: an icon-only button needs a `label`.');
}
</script>

<template>
  <NuxtLink
    v-if="to !== undefined"
    :to="to"
    :class="classes"
    :aria-label="label"
    :aria-disabled="unavailable ? 'true' : undefined"
    :aria-busy="busy ? 'true' : undefined"
  >
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :class="classes"
    :aria-label="label"
    :aria-busy="busy ? 'true' : undefined"
    :disabled="unavailable"
  >
    <slot />
  </button>
</template>
