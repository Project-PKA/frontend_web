<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createNotificationsApi, type ActivityEntry } from '../api/notifications';
import { createTeamApi } from '../api/team';
import type { TableColumn } from '../components/AppTable.vue';
import {
  actionTextKey,
  authorLabel,
  isDestructive,
  notificationTextKey,
  shortId,
  targetTextKey,
} from '../utils/activity';
import { useCursorList } from '../utils/cursor-list';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.activity',
  access: { level: 'store' },
});

const { t } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createNotificationsApi(useApi());
const teamApi = createTeamApi(useApi());
const unread = useUnreadCount();

// The log is the owner's: the API refuses everyone else, so the tab is not even offered.
const tabs = computed(() => [
  {
    id: 'notifications',
    label:
      unread.value > 0
        ? t('activity.tabs.notificationsCount', { count: unread.value })
        : t('activity.tabs.notifications'),
  },
  ...(access.isOwner ? [{ id: 'log', label: t('activity.tabs.log') }] : []),
]);
const active = ref('notifications');

const notices = useCursorList({
  queryKey: () => ['notifications', access.storeId],
  fetchPage: (cursor, signal) => api.list(cursor, signal),
});

const log = useCursorList({
  queryKey: () => ['activity-log', access.storeId],
  fetchPage: (cursor, signal) => api.activityLog(cursor, signal),
  enabled: () => access.isOwner,
});

const team = useQuery({
  queryKey: computed(() => ['team', access.storeId]),
  queryFn: ({ signal }) => teamApi.list(signal),
  enabled: computed(() => access.isOwner),
});
const members = computed(
  () => new Map((team.data.value?.items ?? []).map((member) => [member.user_id, member])),
);

const failure = ref<string | null>(null);
const busyId = ref<string | null>(null);
const markingAll = ref(false);

async function refreshNotices() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: ['unread-count'] }),
  ]);
}

async function markRead(id: string) {
  busyId.value = id;
  failure.value = null;
  try {
    await api.markRead(id);
    await refreshNotices();
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busyId.value = null;
  }
}

async function markAllRead() {
  markingAll.value = true;
  failure.value = null;
  try {
    await api.markAllRead();
    await refreshNotices();
    toast.success(t('activity.notifications.allRead'));
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    markingAll.value = false;
  }
}

const columns = computed<TableColumn[]>(() => [
  { key: 'when', label: t('activity.log.columns.when') },
  { key: 'user', label: t('activity.log.columns.user') },
  { key: 'action', label: t('activity.log.columns.action') },
  { key: 'item', label: t('activity.log.columns.item') },
]);

interface LogRow {
  id: string;
  when: string;
  user: string;
  action: string;
  destructive: boolean;
  item: string;
}

function toRow(entry: ActivityEntry): LogRow {
  const targetKey = targetTextKey(entry.target_type);
  const id = shortId(entry.target_id);
  return {
    id: entry.id,
    when: format.dateTime(entry.created_at),
    user:
      entry.actor_user_id === null
        ? t('activity.log.system')
        : (authorLabel(entry.actor_user_id, members.value) ?? t('activity.log.formerMember')),
    action: t(actionTextKey(entry.action)),
    destructive: isDestructive(entry.action),
    item: [targetKey ? t(targetKey) : null, id ? `#${id}` : null].filter(Boolean).join(' '),
  };
}
const rows = computed(() => log.items.value.map(toRow));
</script>

<template>
  <div class="stack">
    <AppTabs v-model="active" :tabs="tabs" :label="t('activity.tabs.label')">
      <template #default="{ active: current }">
        <AppCard
          v-if="current === 'notifications'"
          as="section"
          :aria-label="t('activity.tabs.notifications')"
        >
          <div class="row activity__bar">
            <AppButton size="sm" :busy="markingAll" :disabled="unread === 0" @click="markAllRead">
              {{ t('activity.notifications.markAll') }}
            </AppButton>
          </div>
          <AppDataState
            :loading="notices.isLoading.value"
            :error="notices.isError.value"
            :empty="notices.items.value.length === 0"
            :labels="{
              loading: t('activity.notifications.loading'),
              emptyTitle: t('activity.notifications.emptyTitle'),
              emptyText: t('activity.notifications.emptyText'),
              errorTitle: t('activity.notifications.errorTitle'),
              errorText: t('activity.notifications.errorText'),
              retry: t('activity.notifications.retry'),
            }"
            @retry="notices.refetch()"
          >
            <ul class="feed activity__feed">
              <li
                v-for="item in notices.items.value"
                :key="item.id"
                :class="['feed__item', !item.read && 'feed__item--unread']"
              >
                <span class="time">{{ format.dateTime(item.created_at) }}</span>
                <span class="grow">
                  <b>{{ t(notificationTextKey(item.kind)) }}</b>
                  <AppBadge v-if="!item.read" tone="info">{{
                    t('activity.notifications.new')
                  }}</AppBadge>
                </span>
                <AppButton
                  v-if="!item.read"
                  size="sm"
                  variant="ghost"
                  :busy="busyId === item.id"
                  @click="markRead(item.id)"
                >
                  {{ t('activity.notifications.markRead') }}
                </AppButton>
              </li>
            </ul>
            <div v-if="notices.hasNextPage.value" class="row activity__more card__foot">
              <AppButton
                size="sm"
                :busy="notices.isFetchingNextPage.value"
                @click="notices.fetchNextPage()"
              >
                {{ t('activity.notifications.loadMore') }}
              </AppButton>
            </div>
          </AppDataState>
          <p v-if="failure" role="alert" class="hint hint--error activity__error">{{ failure }}</p>
        </AppCard>

        <AppCard v-else as="section" :aria-label="t('activity.tabs.log')">
          <AppDataState
            :loading="log.isLoading.value"
            :error="log.isError.value"
            :empty="rows.length === 0"
            :labels="{
              loading: t('activity.log.loading'),
              emptyTitle: t('activity.log.emptyTitle'),
              emptyText: t('activity.log.emptyText'),
              errorTitle: t('activity.log.errorTitle'),
              errorText: t('activity.log.errorText'),
              retry: t('activity.notifications.retry'),
            }"
            @retry="log.refetch()"
          >
            <AppTable
              :caption="t('activity.log.caption')"
              :columns="columns"
              :rows="rows"
              :row-key="(row: LogRow) => row.id"
            >
              <template #cell-when="{ row }">
                <span class="mono">{{ row.when }}</span>
              </template>
              <template #cell-action="{ row }">
                <AppBadge v-if="row.destructive" tone="danger">{{ row.action }}</AppBadge>
                <template v-else>{{ row.action }}</template>
              </template>
            </AppTable>
            <div v-if="log.hasNextPage.value" class="row activity__more card__foot">
              <AppButton
                size="sm"
                :busy="log.isFetchingNextPage.value"
                @click="log.fetchNextPage()"
              >
                {{ t('activity.log.loadMore') }}
              </AppButton>
            </div>
          </AppDataState>
          <template #foot>{{ t('activity.log.ownerOnly') }}</template>
        </AppCard>
      </template>
    </AppTabs>
  </div>
</template>
