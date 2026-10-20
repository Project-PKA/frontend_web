<script setup lang="ts">
// The Home sends people here to schedule their first auction: the form is a modal of the list.
definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.auctions',
  access: { level: 'store', permission: 'can_manage_auctions' },
  middleware: () => navigateTo('/auctions?new=1', { replace: true }),
});
</script>

<template>
  <div />
</template>
