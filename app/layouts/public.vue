<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
</script>

<template>
  <div>
    <header class="pub-top">
      <div class="wrap">
        <NuxtLink class="brand" to="/">
          <span class="brand__mark" aria-hidden="true" />
          {{ t('brand.name') }}
        </NuxtLink>
        <nav class="row" :aria-label="t('layout.publicNav')">
          <NuxtLink v-if="route.path !== '/login'" class="btn btn--ghost btn--sm" to="/login">{{
            t('auth.login.title')
          }}</NuxtLink>
          <NuxtLink class="btn btn--primary btn--sm" to="/request-access">
            {{ t('auth.login.requestAccess') }}
          </NuxtLink>
        </nav>
      </div>
    </header>
    <slot />
  </div>
</template>
