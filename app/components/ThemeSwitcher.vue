<script setup lang="ts">
import { THEMES, type Theme } from '../utils/theme';

const { t } = useI18n();
const preferences = usePreferencesStore();
const errorMessage = useErrorMessage();

const failure = ref<string | null>(null);

async function choose(theme: Theme) {
  failure.value = null;
  try {
    await preferences.changeTheme(theme);
  } catch (error) {
    failure.value = errorMessage(error);
  }
}
</script>

<template>
  <div class="field theme-seg">
    <span id="theme-label" class="label">{{ t('theme.label') }}</span>
    <div class="seg" role="group" aria-labelledby="theme-label">
      <button
        v-for="theme in THEMES"
        :key="theme"
        type="button"
        :class="{ 'is-active': preferences.theme === theme }"
        :aria-pressed="preferences.theme === theme"
        @click="choose(theme)"
      >
        {{ t(`theme.${theme}`) }}
      </button>
    </div>
    <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
  </div>
</template>
