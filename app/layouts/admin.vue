<script setup lang="ts">
import { ADMIN_NAV_ITEMS, isCurrent } from '../utils/navigation';

/**
 * The shell of the admin area: its own menu (no store), the `/admin` badge in the top bar and the
 * way back to the stores. Like the app of a store, the menu is a drawer on small screens.
 */
const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();

const menuOpen = ref(false);
const menuButton = ref<{ $el: HTMLElement } | null>(null);
const sideNav = ref<{ $el: HTMLElement } | null>(null);

const items = computed(() =>
  ADMIN_NAV_ITEMS.map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon,
    to: item.to,
    current: isCurrent(item, route.path),
  })),
);

const email = computed(() => session.user?.email ?? '');
const title = computed(() => {
  const key = route.meta.titleKey;
  return typeof key === 'string' ? t(key) : null;
});

useHead({
  title: () => title.value ?? undefined,
  titleTemplate: (page) => (page ? `${page} · ${t('admin.brand')}` : t('admin.brand')),
  meta: [{ name: 'robots', content: 'noindex' }],
});

async function openMenu() {
  menuOpen.value = true;
  await nextTick();
  sideNav.value?.$el.querySelector<HTMLElement>('.nav__item')?.focus();
}

function closeMenu(restoreFocus = false) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) void nextTick(() => menuButton.value?.$el.focus());
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) closeMenu(true);
}

// The drawer only exists on small screens: leaving them closes it.
const wide = import.meta.client ? window.matchMedia('(min-width: 901px)') : null;
function onWidthChange(event: MediaQueryListEvent) {
  if (event.matches) closeMenu();
}
onMounted(() => {
  wide?.addEventListener('change', onWidthChange);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  wide?.removeEventListener('change', onWidthChange);
  document.removeEventListener('keydown', onKeydown);
});

watch(
  () => route.path,
  () => closeMenu(),
);
</script>

<template>
  <div :class="['app', 'app--admin', menuOpen && 'is-menu']">
    <div class="scrim" aria-hidden="true" @click="closeMenu(true)" />

    <AppSideNav
      ref="sideNav"
      :brand="t('admin.brand')"
      home="/admin"
      :nav-label="t('admin.nav.label')"
      :items="items"
      :account="{
        email,
        text: t('admin.backToStores'),
        label: t('admin.backToStoresAs', { email }),
        to: '/stores',
      }"
      @navigate="closeMenu()"
    />

    <!-- Behind the open drawer nothing can be reached by keyboard or screen reader. -->
    <div class="app__main" :inert="menuOpen || undefined">
      <header class="topbar">
        <AppButton
          ref="menuButton"
          class="menu-btn"
          icon
          variant="ghost"
          :label="t('shell.openMenu')"
          aria-controls="app-menu"
          :aria-expanded="menuOpen"
          @click="openMenu"
        >
          <AppIcon name="menu" />
        </AppButton>
        <h1 v-if="title" class="topbar__title">{{ title }}</h1>
        <div v-else class="topbar__title" />
        <ThemeSwitcher compact />
        <AppBadge tone="primary">/admin</AppBadge>
      </header>
      <main id="main" class="page">
        <slot />
      </main>
    </div>
  </div>
</template>
