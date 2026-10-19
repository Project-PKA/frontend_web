<script setup lang="ts">
import AppBadge from './AppBadge.vue';
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    /** The card that creates a store: dashed, with a plus. */
    kind?: 'store' | 'new';
    to: string;
    name?: string;
    /** "Owner" or "Staff", already translated. */
    roleLabel?: string;
    /** The WhatsApp state, already translated. */
    status?: { on: boolean; text: string };
    /** The card in the middle of the deck: the others are smaller and dimmer. */
    selected?: boolean;
    /** Text of the new-store card. */
    newLabel?: string;
  }>(),
  {
    kind: 'store',
    name: undefined,
    roleLabel: undefined,
    status: undefined,
    selected: false,
    newLabel: undefined,
  },
);

/** The click, so the deck can first bring a card to the middle (see `StoreDeck`). */
const emit = defineEmits<{ select: [event: MouseEvent] }>();

/** The shine and the tilt of the design follow the pointer (they are off with reduced motion). */
const reduceMotion = import.meta.client
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

function follow(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  card.style.setProperty('--x', `${(x * 100).toFixed(1)}%`);
  card.style.setProperty('--y', `${(y * 100).toFixed(1)}%`);
  if (reduceMotion) return;
  card.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(1)}deg`);
  card.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(1)}deg`);
}

function reset(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement;
  for (const [name, value] of [
    ['--x', '50%'],
    ['--y', '50%'],
    ['--rx', '0deg'],
    ['--ry', '0deg'],
  ] as const) {
    card.style.setProperty(name, value);
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
</script>

<template>
  <NuxtLink
    :to="to"
    :class="['tcg', 'store-card', kind === 'new' && 'store-card--new', selected && 'is-sel']"
    @click="emit('select', $event)"
    @pointermove="follow"
    @pointerleave="reset"
  >
    <template v-if="kind === 'new'">
      <span class="empty__art" aria-hidden="true"><AppIcon name="plus" /></span>
      <b class="store-card__name">{{ newLabel }}</b>
    </template>
    <template v-else>
      <div class="row store-card__top">
        <AppBadge tone="primary">{{ roleLabel }}</AppBadge>
        <span v-if="status" class="mono store-card__status">
          <span aria-hidden="true">● </span>{{ status.text }}
        </span>
      </div>
      <b class="store-card__name">{{ name }}</b>
      <div class="store-card__art" aria-hidden="true">{{ initials(name ?? '') }}</div>
    </template>
  </NuxtLink>
</template>
