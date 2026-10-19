<script setup lang="ts">
import { setupComplete, setupDone, setupSteps } from '../utils/home';

/** The welcome checklist of a new store: it shows until the four steps are done. */
const { t } = useI18n();
const access = useAccessStore();
const setup = useHomeData((home) => home.setup);

const steps = computed(() => (setup.data.value ? setupSteps(setup.data.value) : []));
const show = computed(() => (setup.data.value ? !setupComplete(setup.data.value) : false));
const done = computed(() => (setup.data.value ? setupDone(setup.data.value) : 0));

/** Only who can open the destination is sent there. */
function stepLink(id: string): string | null {
  if (id === 'whatsapp') return access.isOwner ? '/settings' : null;
  if (id === 'card') return access.can('can_manage_inventory') ? '/inventory/new' : null;
  if (id === 'auction') return access.can('can_manage_auctions') ? '/auctions/new' : null;
  return null;
}
</script>

<template>
  <AppCard v-if="show" as="section" :title="t('home.setup.title')">
    <template #head>
      <span class="mono faint">{{ t('home.setup.progress', { done, total: steps.length }) }}</span>
    </template>
    <AppProgress
      :value="done"
      :max="steps.length"
      :label="t('home.setup.title')"
      :value-text="t('home.setup.progress', { done, total: steps.length })"
    />
    <ul class="home__steps">
      <li v-for="step in steps" :key="step.id" class="row home__step">
        <AppBadge :tone="step.done ? 'success' : 'warning'">
          {{ step.done ? t('home.setup.done') : t('home.setup.pending') }}
        </AppBadge>
        <div class="grow">
          <b>{{ t(`home.setup.steps.${step.id}.title`) }}</b>
          <br />
          <span class="muted">{{ t(`home.setup.steps.${step.id}.text`) }}</span>
        </div>
        <template v-if="!step.done">
          <AppButton v-if="step.blocked" size="sm" disabled>
            {{ t(`home.setup.steps.${step.id}.action`) }}
          </AppButton>
          <AppButton
            v-else-if="stepLink(step.id)"
            size="sm"
            variant="primary"
            :to="stepLink(step.id) ?? undefined"
          >
            {{ t(`home.setup.steps.${step.id}.action`) }}
          </AppButton>
        </template>
      </li>
    </ul>
  </AppCard>
</template>
