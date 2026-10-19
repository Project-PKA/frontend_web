<script setup lang="ts">
import { LANGUAGES, isLanguage, type Language } from '../utils/language';
import AppSelect from './AppSelect.vue';

const NAMES: Record<Language, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

const { t } = useI18n();
const preferences = usePreferencesStore();
const errorMessage = useErrorMessage();

const failure = ref<string | null>(null);

async function change(value: string) {
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
  <AppSelect
    :model-value="preferences.language"
    :label="t('language.label')"
    :error="failure"
    @update:model-value="change"
  >
    <option v-for="code in LANGUAGES" :key="code" :value="code" :lang="code">
      {{ NAMES[code] }}
    </option>
  </AppSelect>
</template>
