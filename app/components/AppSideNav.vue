<script setup lang="ts">
import AppIcon from './AppIcon.vue';

export interface SideNavItem {
  id: string;
  label: string;
  icon: string;
  to: string;
  current: boolean;
}

withDefaults(
  defineProps<{
    /** Name of the product, already translated. */
    brand: string;
    /** Where the name of the product leads. */
    home?: string;
    /** Names the navigation for screen readers. */
    navLabel: string;
    items: SideNavItem[];
    /** Without a store (the admin area has none) the block of the store is not shown. */
    storeName?: string;
    /** "Owner" or "Staff", already translated. */
    storeRole?: string;
    /** Name of the link that goes back to the choice of store. */
    storeLabel?: string;
    /** `text` is shown under the e-mail; `label` is the full name of the link for screen readers. `to` is where it leads (the profile). */
    account: { email: string; text: string; label: string; to?: string };
  }>(),
  { home: '/home', storeName: undefined, storeRole: undefined, storeLabel: undefined },
);

/** A link was used: the drawer of small screens closes. */
const emit = defineEmits<{ navigate: [] }>();
</script>

<template>
  <aside id="app-menu" class="side">
    <NuxtLink class="brand" :to="home" :aria-label="brand" @click="emit('navigate')">
      <span class="brand__mark" aria-hidden="true" />
      <span class="lb">{{ brand }}</span>
    </NuxtLink>

    <NuxtLink
      v-if="storeName"
      class="store-switch"
      to="/stores"
      :aria-label="storeLabel"
      :title="storeLabel"
      @click="emit('navigate')"
    >
      <span class="avatar" aria-hidden="true" />
      <span class="lb">
        {{ storeName }}
        <small>{{ storeRole }}</small>
      </span>
      <AppIcon name="chevron" class="lb" />
    </NuxtLink>

    <nav class="nav" :aria-label="navLabel">
      <!-- The text is hidden in the compact (tablet) menu, so the name is also an aria-label. -->
      <NuxtLink
        v-for="item in items"
        :key="item.id"
        class="nav__item"
        :to="item.to"
        :aria-label="item.label"
        :title="item.label"
        :aria-current="item.current ? 'page' : undefined"
        @click="emit('navigate')"
      >
        <AppIcon :name="item.icon" />
        <span class="lb">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <NuxtLink
      class="side__foot"
      :to="account.to ?? '/profile'"
      :aria-label="account.label"
      :title="account.label"
      @click="emit('navigate')"
    >
      <span class="avatar" aria-hidden="true" />
      <span class="lb">
        {{ account.email }}
        <br />
        <span class="faint">{{ account.text }}</span>
      </span>
    </NuxtLink>
  </aside>
</template>
