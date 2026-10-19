<script setup lang="ts">
import { isCurrent, visibleNavItems } from '../utils/navigation';

/**
 * The shell of the logged-in app: the menu of the store (by permission), the top bar and
 * the page. On small screens the menu is a drawer, opened by the button of the top bar.
 */
const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();
const access = useAccessStore();

const menuOpen = ref(false);
const menuButton = ref<{ $el: HTMLElement } | null>(null);
const sideNav = ref<{ $el: HTMLElement } | null>(null);

const items = computed(() =>
  visibleNavItems({
    authenticated: session.isAuthenticated,
    isPlatformAdmin: access.isPlatformAdmin,
    storeId: access.storeId,
    role: access.role,
    permissions: access.permissions,
  }).map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon,
    to: item.to,
    current: isCurrent(item, route.path),
  })),
);

const storeName = computed(() => access.store?.name ?? '');
const roleLabel = computed(() => (access.role ? t(`role.${access.role}`) : ''));
const email = computed(() => session.user?.email ?? '');

const title = computed(() => {
  const key = route.meta.titleKey;
  return typeof key === 'string' ? t(key) : null;
});

useHead({
  title: () => title.value ?? undefined,
  titleTemplate: (page) => (page ? `${page} · ${t('brand.name')}` : t('brand.name')),
  meta: [{ name: 'robots', content: 'noindex' }],
});

/** The state of the WhatsApp connection, shown in the top bar. */
const whatsapp = computed(() => {
  const status = access.store?.whatsapp_status;
  if (!status) return null;
  return { on: status === 'ONLINE', text: t(`whatsapp.${status}`) };
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
  <div :class="['app', menuOpen && 'is-menu']">
    <div class="scrim" aria-hidden="true" @click="closeMenu(true)" />

    <AppSideNav
      ref="sideNav"
      :brand="t('brand.name')"
      :nav-label="t('shell.mainNav')"
      :items="items"
      :store-name="storeName"
      :store-role="roleLabel"
      :store-label="t('shell.changeStore', { store: storeName, role: roleLabel })"
      :account="{
        email,
        text: t('shell.viewProfile'),
        label: t('shell.profileOf', { email }),
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
        <span
          v-if="whatsapp"
          role="status"
          :class="['status-chip', whatsapp.on ? 'status-chip--on' : 'status-chip--off']"
        >
          {{ whatsapp.text }}
        </span>
        <AppButton to="/activity" size="sm" :label="t('shell.notifications')">
          <AppIcon name="bell" />
        </AppButton>
      </header>
      <main id="main" class="page">
        <slot />
      </main>
    </div>
  </div>
</template>
