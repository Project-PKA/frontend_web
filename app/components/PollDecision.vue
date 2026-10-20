<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { createAuctionsApi, type PollDecision } from '../api/auctions';

/**
 * What the store decides about a poll that reached its ceiling: keep it open, or approve the closing
 * (which announces the winner in the group, so it asks first). Used in the list of polls and in the
 * room of the auction.
 */
const props = defineProps<{
  auctionId: string;
  /** The card, for the texts: "Charizard ex 199/165". */
  title: string;
  /** Who is ahead, for the confirmation; `null` when nobody bid. */
  winner: string | null;
}>();
const emit = defineEmits<{ done: [decision: PollDecision] }>();

const { t } = useI18n();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createAuctionsApi(useApi());

const busy = ref<PollDecision | null>(null);
const failure = ref<string | null>(null);
const confirming = ref(false);

async function decide(decision: PollDecision) {
  busy.value = decision;
  failure.value = null;
  try {
    await api.resolve(props.auctionId, decision);
    confirming.value = false;
    await Promise.all(
      ['auctions', 'auction', 'home', 'inventory'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
    toast.success(
      t(decision === 'APPROVE' ? 'polls.approved' : 'polls.kept', { title: props.title }),
    );
    emit('done', decision);
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="stack">
    <p v-if="failure && !confirming" role="alert" class="hint hint--error">{{ failure }}</p>
    <div class="row polls__actions">
      <AppButton
        :busy="busy === 'KEEP_OPEN'"
        :disabled="busy !== null"
        @click="decide('KEEP_OPEN')"
      >
        {{ t('polls.keepOpen') }}
      </AppButton>
      <AppButton
        variant="primary"
        :disabled="busy !== null"
        @click="
          failure = null;
          confirming = true;
        "
      >
        {{ t('polls.approve') }}
      </AppButton>
    </div>

    <AppModal
      :open="confirming"
      :title="t('polls.confirm.title')"
      :close-label="t('polls.confirm.close')"
      @close="confirming = false"
    >
      <p>
        {{
          winner
            ? t('polls.confirm.text', { title, winner })
            : t('polls.confirm.textNoWinner', { title })
        }}
      </p>
      <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
      <template #foot>
        <AppButton @click="confirming = false">{{ t('polls.confirm.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="busy === 'APPROVE'" @click="decide('APPROVE')">
          {{ t('polls.confirm.approve') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
