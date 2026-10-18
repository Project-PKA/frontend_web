<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';

/**
 * The carousel of store cards: it scrolls sideways with snap, and the card in the middle
 * is the selected one. The cards go in the default slot (`.store-card` elements).
 */
const props = defineProps<{
  /** Names the list of stores for screen readers. */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** How many cards are in the slot (for the dots). */
  count: number;
}>();

/** The index of the card in the middle. */
const selected = defineModel<number>('selected', { default: 0 });

const deck = ref<HTMLElement | null>(null);

const cards = () => [...(deck.value?.querySelectorAll<HTMLElement>('.store-card') ?? [])];

/** The card whose middle is nearest to the middle of the deck. */
function centered(): number {
  const container = deck.value;
  if (!container) return 0;
  const box = container.getBoundingClientRect();
  const middle = box.left + box.width / 2;
  let best = 0;
  let distance = Infinity;
  cards().forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const away = Math.abs(rect.left + rect.width / 2 - middle);
    if (away < distance) {
      distance = away;
      best = index;
    }
  });
  return best;
}

let frame = 0;
function onScroll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    selected.value = centered();
  });
}

function go(index: number) {
  const target = Math.max(0, Math.min(props.count - 1, index));
  const card = cards()[target];
  const container = deck.value;
  if (!card || !container) return;
  // `offsetLeft` is relative to the nearest positioned ancestor, not to the deck: measure the gap
  // between the middle of the card and the middle of the deck instead.
  const cardBox = card.getBoundingClientRect();
  const deckBox = container.getBoundingClientRect();
  const gap = cardBox.left + cardBox.width / 2 - (deckBox.left + deckBox.width / 2);
  container.scrollTo({ left: container.scrollLeft + gap });
}

/**
 * A click on a card that is not in the middle brings it there first, like the design does,
 * so swiping and clicking do not choose by accident. The keyboard (Enter) chooses at once.
 */
function onCardClick(event: MouseEvent) {
  if (event.detail === 0) return;
  const index = cards().findIndex((card) => card.contains(event.target as Node));
  if (index >= 0 && index !== centered()) {
    event.preventDefault();
    go(index);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.target !== deck.value) return;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    go(centered() + 1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    go(centered() - 1);
  }
}

// Attached here, not in the template: the deck is a scroll area, not a control, and the
// keyboard way to choose a card is Tab and Enter on the cards themselves.
onMounted(async () => {
  deck.value?.addEventListener('keydown', onKeydown);
  deck.value?.addEventListener('click', onCardClick, true);
  await nextTick();
  go(0);
  selected.value = centered();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  deck.value?.removeEventListener('keydown', onKeydown);
  deck.value?.removeEventListener('click', onCardClick, true);
});
</script>

<template>
  <div class="stack store-deck">
    <div class="deck-wrap">
      <AppButton
        variant="secondary"
        icon
        :label="previousLabel"
        :disabled="selected <= 0"
        @click="go(selected - 1)"
      >
        <AppIcon name="chevron" class="store-deck__prev" />
      </AppButton>

      <!-- A scroll area the keyboard can reach: arrows move between the cards. -->
      <div
        ref="deck"
        class="deck"
        tabindex="0"
        role="group"
        :aria-label="label"
        @scroll.passive="onScroll"
      >
        <slot />
      </div>

      <AppButton
        variant="secondary"
        icon
        :label="nextLabel"
        :disabled="selected >= count - 1"
        @click="go(selected + 1)"
      >
        <AppIcon name="chevron" class="store-deck__next" />
      </AppButton>
    </div>

    <div class="dots" aria-hidden="true">
      <i v-for="index in count" :key="index" :class="{ 'is-on': index - 1 === selected }" />
    </div>
  </div>
</template>
