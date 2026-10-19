<script setup lang="ts">
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    kind: 'loading' | 'empty' | 'error';
    /** Short text, already translated. */
    title: string;
    text?: string;
    /** Label of the action (e.g. "Try again"); without it there is no button. */
    actionLabel?: string;
    /** Level of the title of the empty state, so the page outline stays in order. */
    headingLevel?: 2 | 3 | 4;
  }>(),
  { text: undefined, actionLabel: undefined, headingLevel: 3 },
);

const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div v-if="kind === 'error'" class="alert alert--danger" role="alert">
    <AppIcon name="alert" />
    <div class="alert__body">
      <p class="alert__title">{{ title }}</p>
      <p v-if="text">{{ text }}</p>
    </div>
    <AppButton v-if="actionLabel" size="sm" @click="emit('action')">{{ actionLabel }}</AppButton>
  </div>

  <div
    v-else
    class="empty"
    :role="kind === 'loading' ? 'status' : undefined"
    :aria-busy="kind === 'loading' ? 'true' : undefined"
  >
    <div class="empty__art">
      <AppIcon :name="kind === 'loading' ? 'clock' : 'box'" />
    </div>
    <p v-if="kind === 'loading'">{{ title }}</p>
    <component :is="`h${headingLevel}`" v-else>{{ title }}</component>
    <p v-if="text" class="muted">{{ text }}</p>
    <AppButton v-if="actionLabel" variant="primary" @click="emit('action')">
      {{ actionLabel }}
    </AppButton>
  </div>
</template>
