<script setup lang="ts">
import { LANGUAGES, isLanguage, type Language } from '../utils/language';

const NAMES: Record<Language, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

const { t } = useI18n();
const preferences = usePreferencesStore();
const errorMessage = useErrorMessage();

const failure = ref<string | null>(null);

async function change(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (!isLanguage(value)) return;
  failure.value = null;
  try {
    await preferences.changeLanguage(value);
  } catch (error) {
    failure.value = errorMessage(error);
  }
}
</script>

<template>
  <div class="field">
    <label class="label" for="language">
      <span>{{ t('language.label') }}</span>
      <select id="language" class="select" :value="preferences.language" @change="change">
        <option v-for="code in LANGUAGES" :key="code" :value="code" :lang="code">
          {{ NAMES[code] }}
        </option>
      </select>
    </label>
    <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
  </div>
</template>
