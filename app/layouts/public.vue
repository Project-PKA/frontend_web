<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();

async function signOut() {
  await session.logout();
  await navigateTo('/login');
}
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
          <!-- Someone who is logged in can sign out; anyone else can sign in or ask for access. -->
          <AppButton v-if="session.isAuthenticated" variant="ghost" size="sm" @click="signOut">
            {{ t('layout.signOut') }}
          </AppButton>
          <template v-else>
            <NuxtLink v-if="route.path !== '/login'" class="btn btn--ghost btn--sm" to="/login">
              {{ t('auth.login.title') }}
            </NuxtLink>
            <NuxtLink class="btn btn--primary btn--sm" to="/request-access">
              {{ t('auth.login.requestAccess') }}
            </NuxtLink>
          </template>
        </nav>
      </div>
    </header>
    <slot />
  </div>
</template>
