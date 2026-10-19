<script setup lang="ts">
import type { CatalogCard } from '../../api/catalog';
import { artUrl } from '../../utils/catalog';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'inventory.new.title',
  access: { level: 'store', permission: 'can_manage_inventory' },
});

const { t } = useI18n();

const text = ref('');
const picked = ref<CatalogCard | null>(null);
const search = useCatalogSearch(text);

const labels = computed(() => ({
  label: t('inventory.new.search.label'),
  hint: t('inventory.new.search.hint'),
  loading: t('inventory.new.search.loading'),
  none: t('inventory.new.search.none', { text: text.value.trim() }),
  error: t('inventory.new.search.error'),
  retry: t('inventory.new.search.retry'),
  count: t(
    'inventory.new.search.count',
    { count: search.results.value.length },
    search.results.value.length,
  ),
}));

/** The big art when the catalog has it, otherwise the small one. */
const art = computed(() => artUrl(picked.value?.image_high_url) ?? artUrl(picked.value?.image_url));
</script>

<template>
  <div class="stack">
    <div class="crumb">
      <NuxtLink to="/inventory">{{ t('nav.inventory') }}</NuxtLink> / {{ t('inventory.new.title') }}
    </div>

    <AppCard
      as="section"
      :title="t('inventory.new.search.title')"
      :aria-label="t('inventory.new.search.title')"
    >
      <div class="catalog__layout">
        <CatalogSearch
          v-model:query="text"
          :results="search.results.value"
          :loading="search.loading.value"
          :error="search.error.value"
          :labels="labels"
          @select="picked = $event"
          @retry="search.retry()"
        />

        <div class="catalog__picked" aria-live="polite">
          <div class="tcg catalog__art">
            <img
              v-if="art"
              :src="art"
              :alt="t('inventory.new.picked.art', { name: picked?.name ?? '' })"
              decoding="async"
              referrerpolicy="no-referrer"
            />
            <div v-else class="tcg__ph">
              {{ picked ? t('inventory.new.picked.noArt') : t('inventory.new.picked.placeholder') }}
            </div>
          </div>
          <span v-if="picked" class="muted catalog__caption">
            <b>{{ picked.name }}</b>
            <br />
            {{ picked.set_name }} · {{ picked.number }}
            <template v-if="picked.rarity">
              <br />
              {{ t('inventory.new.picked.rarity', { rarity: picked.rarity }) }}
            </template>
          </span>
          <span v-else class="muted catalog__caption">{{ t('inventory.new.picked.empty') }}</span>
        </div>
      </div>
    </AppCard>
  </div>
</template>
