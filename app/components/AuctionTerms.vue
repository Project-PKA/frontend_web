<script setup lang="ts">
/**
 * The terms of an auction, the same in the form of a new auction and in the one that edits it:
 * type (free bid or poll), start and end, opening bid, minimum increment and, for a poll, the
 * ceiling. The page validates; this shows the fields and the errors it is given.
 */
const props = defineProps<{
  /** Show the start (Schedule); without it the auction starts now. */
  needsStart: boolean;
  /** An auction that is running: only the end can change. */
  endOnly?: boolean;
  /** Translated error of each field, or `null`. */
  errors: Partial<
    Record<'type' | 'start' | 'end' | 'initial' | 'increment' | 'ceiling', string | null>
  >;
  disabled?: boolean;
}>();

const type = defineModel<string>('type', { required: true });
const start = defineModel<string>('start', { required: true });
const end = defineModel<string>('end', { required: true });
const initial = defineModel<string>('initial', { required: true });
const increment = defineModel<string>('increment', { required: true });
const ceiling = defineModel<string>('ceiling', { required: true });

const { t } = useI18n();
const locked = computed(() => props.disabled === true || props.endOnly === true);
</script>

<template>
  <div class="stack">
    <div class="form-grid">
      <AppInput
        v-if="needsStart"
        v-model="start"
        :label="t('auctions.terms.start')"
        :error="errors.start"
        :disabled="locked"
        type="datetime-local"
        name="start"
      />
      <AppInput
        v-model="end"
        :label="t('auctions.terms.end')"
        :error="errors.end"
        :disabled="disabled"
        type="datetime-local"
        name="end"
      />
    </div>

    <div class="field">
      <span id="auction-type-label" class="label">{{ t('auctions.terms.type') }}</span>
      <div class="seg" role="group" aria-labelledby="auction-type-label">
        <button
          type="button"
          :class="{ 'is-active': type === 'FREE_BID' }"
          :aria-pressed="type === 'FREE_BID'"
          :disabled="locked"
          @click="type = 'FREE_BID'"
        >
          {{ t('auctions.types.FREE_BID') }}
        </button>
        <button
          type="button"
          :class="{ 'is-active': type === 'POLL' }"
          :aria-pressed="type === 'POLL'"
          :disabled="locked"
          @click="type = 'POLL'"
        >
          {{ t('auctions.types.POLL') }}
        </button>
      </div>
      <p v-if="type === 'POLL'" class="hint">{{ t('auctions.terms.pollHint') }}</p>
    </div>

    <div class="form-grid">
      <AppInput
        v-model="initial"
        :label="t('auctions.terms.initial')"
        :error="errors.initial"
        :disabled="locked"
        inputmode="decimal"
        autocomplete="off"
        name="initial"
      />
      <AppInput
        v-model="increment"
        :label="t('auctions.terms.increment')"
        :error="errors.increment"
        :disabled="locked"
        inputmode="decimal"
        autocomplete="off"
        name="increment"
      />
      <AppInput
        v-if="type === 'POLL'"
        v-model="ceiling"
        :label="t('auctions.terms.ceiling')"
        :error="errors.ceiling"
        :hint="t('auctions.terms.ceilingHint')"
        :disabled="locked"
        inputmode="decimal"
        autocomplete="off"
        name="ceiling"
      />
    </div>
  </div>
</template>
