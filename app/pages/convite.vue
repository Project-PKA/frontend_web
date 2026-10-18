<script setup lang="ts">
/**
 * The invitation e-mails of the Backend still link to `/convite#token=...` (Backend#89 moves
 * them to `/invite`). The fragment must survive the redirect.
 */
definePageMeta({
  i18n: false,
  middleware: (to) => navigateTo({ path: '/invite', hash: to.hash }, { replace: true }),
});
</script>

<template>
  <div />
</template>
