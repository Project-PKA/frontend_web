<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createStoreApi, type StoreChanges, type TemplateKey } from '../../api/store';
import {
  PIX_MAX,
  TEMPLATE_MAX,
  emptyToNull,
  isGroupInviteUrl,
  placeholderToken,
  unknownPlaceholders,
} from '../../utils/settings';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.settings',
  access: { level: 'store', owner: true },
});

const { t, te } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createStoreApi(useApi());

const store = computed(() => access.store);

/** Saves what changed in the store, then reads the store again so the screen shows what is kept. */
async function saveStore(changes: StoreChanges) {
  await api.update(changes);
  await access.loadStore(true);
}

// ---- WhatsApp: the connection, and the group the bot watches
const statusText = computed(() =>
  store.value ? t(`whatsapp.${store.value.whatsapp_status}`) : '',
);
const statusTone = computed(() =>
  store.value?.whatsapp_status === 'ONLINE' ? 'success' : 'danger',
);

const groupUrl = ref(store.value?.whatsapp_invite_url ?? '');
watch(
  () => store.value?.whatsapp_invite_url,
  (value) => (groupUrl.value = value ?? ''),
);
const groupError = ref<string | null>(null);
const groupBusy = ref(false);

async function saveGroup() {
  const value = emptyToNull(groupUrl.value);
  if (value !== null && !isGroupInviteUrl(value)) {
    groupError.value = t('settings.group.invalid');
    return;
  }
  groupError.value = null;
  groupBusy.value = true;
  try {
    await saveStore({ whatsapp_invite_url: value });
    toast.success(t('settings.group.saved'));
  } catch (error) {
    groupError.value = errorMessage(error);
  } finally {
    groupBusy.value = false;
  }
}

// ---- PIX key
const pixKey = ref(store.value?.pix_key ?? '');
watch(
  () => store.value?.pix_key,
  (value) => (pixKey.value = value ?? ''),
);
const pixError = ref<string | null>(null);
const pixBusy = ref(false);

async function savePix() {
  if (pixKey.value.trim().length > PIX_MAX) {
    pixError.value = t('validation.tooLong');
    return;
  }
  pixError.value = null;
  pixBusy.value = true;
  try {
    await saveStore({ pix_key: emptyToNull(pixKey.value) });
    toast.success(t('settings.pix.saved'));
  } catch (error) {
    pixError.value = errorMessage(error);
  } finally {
    pixBusy.value = false;
  }
}

// ---- Public showcase: opt-in, and it makes the link of the group public, so it asks first
const showcaseOn = computed(() => store.value?.showcase_enabled === true);
const hasGroup = computed(() => !!store.value?.whatsapp_invite_url);
const confirmingShowcase = ref(false);
/** The switch is a native checkbox that flips by itself: a new key puts it back where the store is. */
const switchKey = ref(0);
const acknowledged = ref(false);
const showcaseBusy = ref(false);
const showcaseError = ref<string | null>(null);

function onShowcaseToggle(next: boolean) {
  showcaseError.value = null;
  if (next) {
    acknowledged.value = false;
    confirmingShowcase.value = true;
  } else {
    void setShowcase(false);
  }
}

function closeShowcase() {
  confirmingShowcase.value = false;
  switchKey.value += 1;
}

async function setShowcase(enabled: boolean) {
  showcaseBusy.value = true;
  showcaseError.value = null;
  try {
    await saveStore(
      enabled
        ? { showcase_enabled: true, acknowledge_public_group_link: true }
        : { showcase_enabled: false },
    );
    confirmingShowcase.value = false;
    toast.success(t(enabled ? 'settings.showcase.on' : 'settings.showcase.off'));
  } catch (error) {
    showcaseError.value = errorMessage(error);
    switchKey.value += 1;
  } finally {
    showcaseBusy.value = false;
  }
}

// ---- Messages of the bot
const templates = useQuery({
  queryKey: computed(() => ['templates', access.storeId]),
  queryFn: ({ signal }) => api.templates(signal),
});

const drafts = reactive<Record<string, string>>({});
const failures = reactive<Record<string, string | null>>({});
const busyKey = ref<string | null>(null);

/** What the store says now: its own text, or the default of the bot. */
const current = (item: { custom_body: string | null; default_body: string }) =>
  item.custom_body ?? item.default_body;

watch(
  () => templates.data.value,
  (data) => {
    for (const item of data?.items ?? []) {
      // A text being edited is not thrown away when the list is read again.
      if (drafts[item.key] === undefined) drafts[item.key] = current(item);
    }
  },
  { immediate: true },
);

const nameOf = (key: string) =>
  te(`settings.templates.keys.${key}`) ? t(`settings.templates.keys.${key}`) : key;

async function saveTemplate(item: { key: TemplateKey; placeholders: string[] }) {
  const text = drafts[item.key] ?? '';
  if (text.trim() === '') {
    failures[item.key] = t('validation.required');
    return;
  }
  if (text.length > TEMPLATE_MAX) {
    failures[item.key] = t('validation.tooLong');
    return;
  }
  const unknown = unknownPlaceholders(text, item.placeholders);
  if (unknown.length > 0) {
    failures[item.key] = t('settings.templates.unknown', {
      names: unknown.map(placeholderToken).join(', '),
    });
    return;
  }
  failures[item.key] = null;
  busyKey.value = item.key;
  try {
    const saved = await api.setTemplate(item.key, text);
    drafts[item.key] = current(saved);
    await queryClient.invalidateQueries({ queryKey: ['templates'] });
    toast.success(t('settings.templates.saved'));
  } catch (error) {
    failures[item.key] = errorMessage(error);
  } finally {
    busyKey.value = null;
  }
}

async function resetTemplate(item: { key: TemplateKey }) {
  failures[item.key] = null;
  busyKey.value = item.key;
  try {
    const reset = await api.resetTemplate(item.key);
    drafts[item.key] = current(reset);
    await queryClient.invalidateQueries({ queryKey: ['templates'] });
    toast.success(t('settings.templates.reset'));
  } catch (error) {
    failures[item.key] = errorMessage(error);
  } finally {
    busyKey.value = null;
  }
}
</script>

<template>
  <div class="stack">
    <div class="cols-2">
      <AppCard as="section" :aria-label="t('settings.whatsapp.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settings.whatsapp.title') }}</h2>
          <AppBadge v-if="store" :tone="statusTone">{{ statusText }}</AppBadge>
        </div>
        <div class="card__body stack">
          <p class="muted">{{ t('settings.whatsapp.text') }}</p>
          <p class="muted">{{ t('settings.whatsapp.qr') }}</p>
          <div class="row">
            <AppButton to="/whatsapp" size="sm">{{ t('settings.whatsapp.steps') }}</AppButton>
          </div>
        </div>
      </AppCard>

      <AppCard as="section" :aria-label="t('settings.group.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settings.group.title') }}</h2>
        </div>
        <form class="card__body stack" novalidate @submit.prevent="saveGroup">
          <AppInput
            v-model="groupUrl"
            :label="t('settings.group.label')"
            :hint="t('settings.group.hint')"
            :error="groupError"
            type="url"
            name="group"
            autocomplete="off"
            placeholder="https://chat.whatsapp.com/..."
          />
          <div class="row">
            <AppButton type="submit" variant="primary" size="sm" :busy="groupBusy">
              {{ t('settings.save') }}
            </AppButton>
          </div>
        </form>
      </AppCard>
    </div>

    <div class="cols-2">
      <AppCard as="section" :aria-label="t('settings.pix.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settings.pix.title') }}</h2>
        </div>
        <form class="card__body stack" novalidate @submit.prevent="savePix">
          <AppInput
            v-model="pixKey"
            :label="t('settings.pix.label')"
            :hint="t('settings.pix.hint')"
            :error="pixError"
            name="pix"
            autocomplete="off"
            :maxlength="PIX_MAX + 20"
          />
          <div class="row">
            <AppButton type="submit" variant="primary" size="sm" :busy="pixBusy">
              {{ t('settings.save') }}
            </AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard as="section" :aria-label="t('settings.showcase.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settings.showcase.title') }}</h2>
        </div>
        <div class="card__body stack">
          <AppSwitch
            :key="switchKey"
            :model-value="showcaseOn"
            :disabled="showcaseBusy || (!showcaseOn && !hasGroup)"
            @update:model-value="onShowcaseToggle"
          >
            {{ t('settings.showcase.label') }}
          </AppSwitch>
          <p class="muted">{{ t('settings.showcase.text') }}</p>
          <p v-if="!showcaseOn && !hasGroup" class="hint">
            {{ t('settings.showcase.needsGroup') }}
          </p>
          <p v-if="showcaseError" role="alert" class="hint hint--error">{{ showcaseError }}</p>
        </div>
      </AppCard>
    </div>

    <AppCard as="section" :aria-label="t('settings.templates.title')">
      <div class="card__head">
        <h2 class="card__title">{{ t('settings.templates.title') }}</h2>
      </div>
      <AppDataState
        :loading="templates.isPending.value"
        :error="templates.isError.value"
        :empty="(templates.data.value?.items ?? []).length === 0"
        :labels="{
          loading: t('settings.templates.loading'),
          emptyTitle: t('settings.templates.empty'),
          errorTitle: t('settings.templates.error'),
          retry: t('settings.templates.retry'),
        }"
        @retry="templates.refetch()"
      >
        <div class="card__body stack">
          <p class="muted">{{ t('settings.templates.intro') }}</p>
          <div
            v-for="item in templates.data.value?.items ?? []"
            :key="item.key"
            class="stack settings__template"
          >
            <AppTextarea
              v-model="drafts[item.key]"
              :label="nameOf(item.key)"
              :error="failures[item.key]"
              :name="`template-${item.key}`"
              rows="3"
            />
            <div v-if="item.placeholders.length > 0" class="row settings__tokens">
              <span class="faint settings__tokens-label">{{ t('settings.templates.tokens') }}</span>
              <span v-for="name in item.placeholders" :key="name" class="id-chip">
                {{ placeholderToken(name) }}
              </span>
            </div>
            <div class="row settings__actions">
              <AppButton
                size="sm"
                :disabled="item.custom_body === null || busyKey === item.key"
                :label="t('settings.templates.resetAria', { name: nameOf(item.key) })"
                @click="resetTemplate(item)"
              >
                {{ t('settings.templates.resetOne') }}
              </AppButton>
              <AppButton
                size="sm"
                variant="primary"
                :busy="busyKey === item.key"
                :disabled="drafts[item.key] === current(item)"
                :label="t('settings.templates.saveAria', { name: nameOf(item.key) })"
                @click="saveTemplate(item)"
              >
                {{ t('settings.save') }}
              </AppButton>
            </div>
          </div>
        </div>
      </AppDataState>
    </AppCard>

    <AppModal
      :open="confirmingShowcase"
      :title="t('settings.showcase.confirmTitle')"
      :close-label="t('settings.close')"
      @close="closeShowcase"
    >
      <div class="stack">
        <p>{{ t('settings.showcase.confirmText') }}</p>
        <AppSwitch v-model="acknowledged" :disabled="showcaseBusy">
          {{ t('settings.showcase.acknowledge') }}
        </AppSwitch>
        <p v-if="showcaseError" role="alert" class="hint hint--error">{{ showcaseError }}</p>
      </div>
      <template #foot>
        <AppButton @click="closeShowcase">{{ t('settings.cancel') }}</AppButton>
        <AppButton
          variant="primary"
          :busy="showcaseBusy"
          :disabled="!acknowledged"
          @click="setShowcase(true)"
        >
          {{ t('settings.showcase.turnOn') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
