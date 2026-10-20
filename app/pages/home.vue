<script setup lang="ts">
definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.home',
  access: { level: 'store' },
});

// The page only lays the pieces out. It asks for nothing and never refreshes: each piece
// (`useHomeData`) asks again by itself every 15 s, so only the pieces whose data changed update.
</script>

<template>
  <div class="stack">
    <HomeWhatsapp />
    <HomeSetup />
    <HomePollAlert />
    <HomeKpis />
    <HomeNoAuction />
    <HomeSettlements />
  </div>
</template>
