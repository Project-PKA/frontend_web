<script setup lang="ts">
import { nextTick, ref, useId } from 'vue';

export interface TabItem {
  id: string;
  label: string;
}

const props = defineProps<{
  tabs: TabItem[];
  /** Names the group of tabs for screen readers. */
  label: string;
}>();

/** The id of the selected tab. */
const active = defineModel<string>({ required: true });

const uid = useId();
const tabId = (id: string) => `${uid}-tab-${id}`;
const panelId = (id: string) => `${uid}-panel-${id}`;

const buttons = ref<HTMLButtonElement[]>([]);

async function select(index: number) {
  const tab = props.tabs[(index + props.tabs.length) % props.tabs.length];
  if (!tab) return;
  active.value = tab.id;
  await nextTick();
  buttons.value[props.tabs.indexOf(tab)]?.focus();
}

/** The keys of the WAI-ARIA tabs pattern: arrows (wrapping), Home and End. */
function onKeydown(index: number, event: KeyboardEvent) {
  const target: Record<string, number> = {
    ArrowRight: index + 1,
    ArrowLeft: index - 1,
    Home: 0,
    End: props.tabs.length - 1,
  };
  const next = target[event.key];
  if (next === undefined) return;
  event.preventDefault();
  void select(next);
}
</script>

<template>
  <div>
    <div class="tabs" role="tablist" :aria-label="label">
      <button
        v-for="(tab, index) in tabs"
        :id="tabId(tab.id)"
        :key="tab.id"
        :ref="
          (element) => {
            if (element) buttons[index] = element as HTMLButtonElement;
          }
        "
        type="button"
        role="tab"
        :class="['tab', tab.id === active && 'is-active']"
        :aria-selected="tab.id === active"
        :aria-controls="panelId(tab.id)"
        :tabindex="tab.id === active ? 0 : -1"
        @click="active = tab.id"
        @keydown="onKeydown(index, $event)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div :id="panelId(active)" role="tabpanel" tabindex="0" :aria-labelledby="tabId(active)">
      <slot :active="active" />
    </div>
  </div>
</template>
