<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { isApiError } from '../../api/errors';
import { createCustomersApi, type Customer } from '../../api/customers';
import { createStoreApi } from '../../api/store';
import type { TableColumn } from '../../components/AppTable.vue';
import { useCursorList } from '../../utils/cursor-list';
import {
  formatStoredPhone,
  isBrazilPhone,
  maskBrazilPhone,
  phoneDigits,
  toStoredPhone,
} from '../../utils/phone';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'blacklist.title',
  access: { level: 'store', permission: 'can_manage_customers' },
});

const { t } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createCustomersApi(useApi());
const storeApi = createStoreApi(useApi());

async function refresh() {
  await Promise.all(
    ['customers', 'customer', 'inactive'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

// ---- The blocked numbers
const blocked = useCursorList({
  queryKey: () => ['customers', access.storeId, 'blacklisted'],
  fetchPage: (cursor, signal) => api.list({ blacklisted: true }, cursor, signal),
});
const blockedColumns = computed<TableColumn[]>(() => [
  { key: 'phone', label: t('blacklist.columns.phone') },
  { key: 'name', label: t('blacklist.columns.name') },
  { key: 'reason', label: t('blacklist.columns.reason') },
  { key: 'action', label: '' },
]);
const blockedRows = computed(() =>
  blocked.items.value.map((item: Customer) => ({
    id: item.id,
    phone: formatStoredPhone(item.phone),
    name: item.name,
    reason: item.blacklist_reason ?? '',
  })),
);

const removing = ref<string | null>(null);
const removeError = ref<string | null>(null);

async function remove(id: string) {
  removing.value = id;
  removeError.value = null;
  try {
    await api.unblacklist(id);
    await refresh();
    toast.success(t('blacklist.removed'));
  } catch (error) {
    removeError.value = errorMessage(error);
  } finally {
    removing.value = null;
  }
}

// ---- Adding a number: it may not be a customer yet, so it is created first
const adding = ref(false);
const phone = ref('');
const nameText = ref('');
const reason = ref('');
const errors = reactive<{ phone: string | null; reason: string | null }>({
  phone: null,
  reason: null,
});
const busy = ref(false);
const addError = ref<string | null>(null);

function openAdd() {
  phone.value = '';
  nameText.value = '';
  reason.value = '';
  errors.phone = null;
  errors.reason = null;
  addError.value = null;
  adding.value = true;
}

function onPhoneInput(value: string) {
  phone.value = maskBrazilPhone(value);
}

/** The customer with this phone: a new visitor, or the one the store already has. */
async function customerFor(stored: string): Promise<string> {
  const name = nameText.value.trim() || formatStoredPhone(stored);
  try {
    return (await api.create({ phone: stored, name })).id;
  } catch (error) {
    if (!isApiError(error) || error.code !== 'CUSTOMER_PHONE_TAKEN') throw error;
    const found = await api.list({ q: stored });
    const existing = found.items.find((item) => item.phone === stored);
    if (!existing) throw error;
    return existing.id;
  }
}

async function add() {
  const digits = phoneDigits(phone.value);
  errors.phone =
    digits.length >= 8 && (digits.length > 11 || isBrazilPhone(digits))
      ? null
      : t('validation.phone');
  errors.reason = reason.value.trim() === '' ? t('validation.required') : null;
  if (reason.value.trim().length > 300) errors.reason = t('validation.tooLong');
  if (errors.phone || errors.reason) return;

  busy.value = true;
  addError.value = null;
  try {
    const id = await customerFor(toStoredPhone(phone.value));
    await api.blacklist(id, reason.value.trim());
    adding.value = false;
    await refresh();
    toast.success(t('blacklist.added'));
  } catch (error) {
    addError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

// ---- Inactivity: how long a member can be quiet before the bot removes them from the group
const limit = computed(() => access.store?.inactivity_days_limit ?? null);
const days = ref<string | number>(limit.value === null ? '' : String(limit.value));
watch(limit, (value) => (days.value = value === null ? '' : String(value)));

const savingLimit = ref(false);
const limitError = ref<string | null>(null);

async function saveLimit() {
  // A number field gives a number (or an empty text), so it is read as text first.
  const text = String(days.value ?? '').trim();
  const value = text === '' ? null : Number(text);
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    limitError.value = t('validation.days');
    return;
  }
  savingLimit.value = true;
  limitError.value = null;
  try {
    await storeApi.setInactivityLimit(value);
    await access.loadStore(true);
    await refresh();
    toast.success(t('blacklist.inactivity.saved'));
  } catch (error) {
    limitError.value = errorMessage(error);
  } finally {
    savingLimit.value = false;
  }
}

const inactive = useCursorList({
  queryKey: () => ['customers', access.storeId, 'inactive', limit.value],
  fetchPage: (cursor, signal) => api.list({ inactive: true }, cursor, signal),
  enabled: () => limit.value !== null,
});
const inactiveColumns = computed<TableColumn[]>(() => [
  { key: 'member', label: t('blacklist.inactivity.columns.member') },
  { key: 'last', label: t('blacklist.inactivity.columns.last') },
  { key: 'removal', label: t('blacklist.inactivity.columns.removal') },
]);
const inactiveRows = computed(() =>
  inactive.items.value.map((item: Customer) => {
    const last = item.last_interaction_at;
    const removal =
      last && limit.value !== null
        ? new Date(new Date(last).getTime() + limit.value * 86_400_000).toISOString()
        : null;
    return {
      id: item.id,
      member: `${item.name} · ${formatStoredPhone(item.phone)}`,
      last: last ? format.dateTime(last) : '',
      removal: removal ? format.date(removal) : '',
    };
  }),
);
</script>

<template>
  <div class="stack">
    <div class="crumb">
      <NuxtLink to="/customers">{{ t('nav.customers') }}</NuxtLink> / {{ t('blacklist.title') }}
    </div>

    <div class="page-head">
      <h2>{{ t('blacklist.title') }}</h2>
      <div class="row">
        <AppButton variant="primary" @click="openAdd">
          <AppIcon name="plus" />
          {{ t('blacklist.add') }}
        </AppButton>
      </div>
    </div>

    <AppCard
      as="section"
      :title="t('blacklist.blocked.title')"
      :aria-label="t('blacklist.blocked.title')"
    >
      <AppDataState
        :loading="blocked.isLoading.value"
        :error="blocked.isError.value"
        :empty="blockedRows.length === 0"
        :labels="{
          loading: t('blacklist.loading'),
          emptyTitle: t('blacklist.blocked.empty'),
          emptyText: t('blacklist.blocked.emptyText'),
          errorTitle: t('blacklist.error'),
          retry: t('blacklist.retry'),
        }"
        @retry="blocked.refetch()"
      >
        <AppTable
          :caption="t('blacklist.blocked.title')"
          :columns="blockedColumns"
          :rows="blockedRows"
          :row-key="(row) => row.id"
        >
          <template #cell-phone="{ row }">
            <span class="mono">{{ row.phone }}</span>
          </template>
          <template #cell-name="{ row }">
            <NuxtLink :to="`/customers/${row.id}`">{{ row.name }}</NuxtLink>
          </template>
          <template #cell-action="{ row }">
            <AppButton
              size="sm"
              :busy="removing === row.id"
              :disabled="removing !== null"
              @click="remove(row.id)"
            >
              {{ t('blacklist.remove') }}
            </AppButton>
          </template>
        </AppTable>
        <p v-if="removeError" role="alert" class="hint hint--error blacklist__error">
          {{ removeError }}
        </p>
        <div v-if="blocked.hasNextPage.value" class="row customers__more card__foot">
          <AppButton
            size="sm"
            :busy="blocked.isFetchingNextPage.value"
            @click="blocked.fetchNextPage()"
          >
            {{ t('customers.loadMore') }}
          </AppButton>
        </div>
      </AppDataState>
    </AppCard>

    <AppCard
      as="section"
      :title="t('blacklist.inactivity.title')"
      :aria-label="t('blacklist.inactivity.title')"
      body-class="stack"
    >
      <form class="row" novalidate @submit.prevent="saveLimit">
        <span>{{ t('blacklist.inactivity.before') }}</span>
        <input
          v-model="days"
          class="input blacklist__days"
          type="number"
          min="1"
          inputmode="numeric"
          :aria-label="t('blacklist.inactivity.days')"
        />
        <span>{{ t('blacklist.inactivity.after') }}</span>
        <AppButton type="submit" variant="primary" size="sm" :busy="savingLimit">
          {{ t('blacklist.inactivity.save') }}
        </AppButton>
      </form>
      <p class="hint">{{ t('blacklist.inactivity.hint') }}</p>
      <p v-if="limitError" role="alert" class="hint hint--error">{{ limitError }}</p>

      <AppState
        v-if="limit === null"
        kind="empty"
        :title="t('blacklist.inactivity.notSet')"
        :text="t('blacklist.inactivity.notSetText')"
      />
      <AppDataState
        v-else
        :loading="inactive.isLoading.value"
        :error="inactive.isError.value"
        :empty="inactiveRows.length === 0"
        :labels="{
          loading: t('blacklist.loading'),
          emptyTitle: t('blacklist.inactivity.empty'),
          errorTitle: t('blacklist.error'),
          retry: t('blacklist.retry'),
        }"
        @retry="inactive.refetch()"
      >
        <AppTable
          :caption="t('blacklist.inactivity.title')"
          :columns="inactiveColumns"
          :rows="inactiveRows"
          :row-key="(row) => row.id"
        />
      </AppDataState>
    </AppCard>

    <AppModal
      :open="adding"
      :title="t('blacklist.modal.title')"
      :close-label="t('blacklist.modal.close')"
      @close="adding = false"
    >
      <div class="stack">
        <AppInput
          :model-value="phone"
          :label="t('blacklist.modal.phone')"
          :error="errors.phone"
          :placeholder="t('blacklist.modal.phonePlaceholder')"
          inputmode="tel"
          name="phone"
          autocomplete="off"
          @update:model-value="onPhoneInput"
        />
        <AppInput
          v-model="nameText"
          :label="t('blacklist.modal.name')"
          name="name"
          maxlength="120"
          autocomplete="off"
        />
        <AppTextarea
          v-model="reason"
          :label="t('blacklist.modal.reason')"
          :error="errors.reason"
          maxlength="300"
          name="reason"
        />
        <p class="muted">{{ t('blacklist.modal.text') }}</p>
        <p v-if="addError" role="alert" class="hint hint--error">{{ addError }}</p>
      </div>
      <template #foot>
        <AppButton @click="adding = false">{{ t('blacklist.modal.cancel') }}</AppButton>
        <AppButton variant="danger" :busy="busy" @click="add">{{
          t('blacklist.modal.confirm')
        }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>
