<script setup lang="ts">
withDefaults(
  defineProps<{
    /** The element of the card: a `section` or `article` gives it a landmark role. */
    as?: 'div' | 'section' | 'article';
    /** A heading in the card head. Use the `head` slot for something more than text. */
    title?: string;
    /** Level of the heading, so the page outline stays in order. */
    headingLevel?: 2 | 3 | 4;
    interactive?: boolean;
    highlight?: boolean;
    /** Extra classes for the body, e.g. `stack`. */
    bodyClass?: string;
  }>(),
  { as: 'div', headingLevel: 2, title: undefined, bodyClass: undefined },
);
</script>

<template>
  <component
    :is="as"
    :class="['card', interactive && 'card--interactive', highlight && 'card--highlight']"
  >
    <div v-if="title || $slots.head" class="card__head">
      <component :is="`h${headingLevel}`" v-if="title" class="card__title">{{ title }}</component>
      <slot name="head" />
    </div>
    <div :class="['card__body', bodyClass]">
      <slot />
    </div>
    <div v-if="$slots.foot" class="card__foot">
      <slot name="foot" />
    </div>
  </component>
</template>
