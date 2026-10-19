<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { CatalogCard } from '../api/catalog';
import { artUrl, moveHighlight, searchText } from '../utils/catalog';
import AppButton from './AppButton.vue';

/**
 * Search of the card catalog, as you type: a text field with a list of suggestions (the WAI-ARIA
 * "combobox with list autocomplete" pattern). It only shows what it is given and says what the
 * person picked; the page asks the API and owns the text.
 */
const props = defineProps<{
  results: CatalogCard[];
  /** The first answer for this text has not come yet. */
  loading?: boolean;
  error?: boolean;
  labels: {
    label: string;
    /** "Type at least 2 characters." */
    hint: string;
    loading: string;
    /** "No card found for pika." (already with the text in it) */
    none: string;
    error: string;
    retry: string;
    /** "3 cards found", for screen readers. */
    count: string;
  };
}>();

const emit = defineEmits<{ select: [card: CatalogCard]; retry: [] }>();
const query = defineModel<string>('query', { default: '' });

const listId = useId();
const hintId = useId();
const optionId = (index: number) => `${listId}-option-${index}`;

const open = ref(false);
const highlight = ref<number | null>(null);

const ready = computed(() => searchText(query.value) !== null);
const showing = computed(() => open.value && ready.value);
const hasResults = computed(() => props.results.length > 0);
const listOpen = computed(() => showing.value && hasResults.value);

// A new answer (or a new text) starts without a highlight.
watch(
  () => props.results,
  () => (highlight.value = null),
);

function onInput() {
  open.value = true;
  highlight.value = null;
}

function choose(card: CatalogCard) {
  open.value = false;
  highlight.value = null;
  emit('select', card);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!ready.value) return;
    event.preventDefault();
    open.value = true;
    highlight.value = moveHighlight(highlight.value, props.results.length, event.key);
  } else if ((event.key === 'Home' || event.key === 'End') && listOpen.value) {
    event.preventDefault();
    highlight.value = moveHighlight(highlight.value, props.results.length, event.key);
  } else if (event.key === 'Enter') {
    const card = highlight.value === null ? undefined : props.results[highlight.value];
    if (listOpen.value && card) {
      event.preventDefault();
      choose(card);
    }
  } else if (event.key === 'Escape') {
    if (open.value) {
      event.preventDefault();
      open.value = false;
      highlight.value = null;
    } else if (query.value) {
      event.preventDefault();
      query.value = '';
    }
  }
}

// The suggestions are never focused (the focus stays in the field, as in the WAI-ARIA pattern),
// so the pointer is handled on the list itself: a press must not take the focus from the field,
// and a click picks the suggestion under it.
const list = ref<HTMLUListElement | null>(null);

function optionAt(event: Event): CatalogCard | undefined {
  const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="option"]');
  const index = element ? Number(element.dataset.index) : Number.NaN;
  return Number.isInteger(index) ? props.results[index] : undefined;
}
function onListMouseDown(event: MouseEvent) {
  event.preventDefault();
}
function onListClick(event: MouseEvent) {
  const card = optionAt(event);
  if (card) choose(card);
}
onMounted(() => {
  list.value?.addEventListener('mousedown', onListMouseDown);
  list.value?.addEventListener('click', onListClick);
});
onBeforeUnmount(() => {
  list.value?.removeEventListener('mousedown', onListMouseDown);
  list.value?.removeEventListener('click', onListClick);
});

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  // Moving to something inside the list (the "try again" button) keeps it open.
  if (next && (event.currentTarget as HTMLElement).parentElement?.contains(next)) return;
  open.value = false;
}
</script>

<template>
  <div class="catalog-search stack" @focusout="onBlur">
    <div class="field">
      <label class="field" :for="`${listId}-input`">
        <span class="label">{{ labels.label }}</span>
        <input
          :id="`${listId}-input`"
          v-model="query"
          class="input"
          type="text"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          maxlength="80"
          aria-autocomplete="list"
          :aria-expanded="listOpen"
          :aria-controls="listId"
          :aria-activedescendant="highlight === null ? undefined : optionId(highlight)"
          :aria-describedby="hintId"
          @input="onInput"
          @focus="open = true"
          @keydown="onKeydown"
        />
      </label>
      <p :id="hintId" class="hint">{{ labels.hint }}</p>
    </div>

    <p v-if="showing && loading && !hasResults" class="muted" role="status">
      {{ labels.loading }}
    </p>
    <div v-else-if="showing && error" class="alert alert--danger" role="alert">
      <div class="alert__body">{{ labels.error }}</div>
      <AppButton size="sm" @click="emit('retry')">{{ labels.retry }}</AppButton>
    </div>
    <p v-else-if="showing && !hasResults" class="muted" role="status">{{ labels.none }}</p>

    <ul
      v-show="listOpen"
      :id="listId"
      ref="list"
      class="suggest"
      role="listbox"
      :aria-label="labels.label"
    >
      <li
        v-for="(card, index) in results"
        :id="optionId(index)"
        :key="card.id"
        role="option"
        :aria-selected="highlight === index"
        :data-index="index"
        :class="['suggest__item', highlight === index && 'is-active']"
      >
        <span class="tcg tcg--xs" aria-hidden="true">
          <img
            v-if="artUrl(card.image_url)"
            :src="artUrl(card.image_url) ?? undefined"
            alt=""
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          />
        </span>
        <b>{{ card.name }}</b>
        <span class="muted">{{ card.set_name }}</span>
        <small>{{ card.number }}</small>
      </li>
    </ul>

    <p class="visually-hidden" role="status" aria-live="polite">
      {{ listOpen ? labels.count : '' }}
    </p>
  </div>
</template>
