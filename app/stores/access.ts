import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createAccessApi, type AccessApi, type CurrentStore, type Me } from '../api/access';
import { createAppClient } from '../api/instance';
import { toPermissionMap, type Permission, type PermissionMap } from '../utils/permissions';
import { browserStoreStorage, type StoreStorage } from '../utils/store-storage';

/**
 * Who the person is on the platform (`/v1/me`) and what they can do in the
 * current store (`/v1/store`). The server always has the last word: this state
 * only decides what to show.
 */
export function defineAccessStore(getApi: () => AccessApi, storage: StoreStorage, id = 'access') {
  return defineStore(id, () => {
    const me = ref<Me | null>(null);
    const storeId = ref<string | null>(storage.get());
    const store = ref<CurrentStore | null>(null);

    const isPlatformAdmin = computed(() => me.value?.is_platform_admin === true);
    const canCreateStores = computed(() => me.value?.can_create_stores === true);
    const role = computed(() => store.value?.role ?? null);
    const isOwner = computed(() => role.value === 'OWNER');
    const permissions = computed<PermissionMap | null>(() =>
      store.value ? toPermissionMap(store.value.permissions) : null,
    );

    /** The owner can do everything; staff only what was granted. */
    function can(permission: Permission): boolean {
      if (isOwner.value) return true;
      return permissions.value?.[permission] === true;
    }

    async function loadMe(force = false) {
      if (me.value && !force) return;
      me.value = await getApi().getMe();
    }

    /** Loads the role and permissions for the chosen store. Needs `storeId`. */
    async function loadStore(force = false) {
      if (storeId.value === null) return;
      if (store.value?.id === storeId.value && !force) return;
      store.value = await getApi().getStore();
    }

    function selectStore(next: string) {
      if (next === storeId.value) return;
      storeId.value = next;
      store.value = null;
      storage.set(next);
    }

    function clearStore() {
      storeId.value = null;
      store.value = null;
      storage.set(null);
    }

    /** Forget everything about the person, e.g. after logout. */
    function reset() {
      me.value = null;
      clearStore();
    }

    return {
      me,
      storeId,
      store,
      isPlatformAdmin,
      canCreateStores,
      role,
      isOwner,
      permissions,
      can,
      loadMe,
      loadStore,
      selectStore,
      clearStore,
      reset,
    };
  });
}

export const useAccessStore = defineAccessStore(
  () =>
    createAccessApi(
      createAppClient({
        getStoreId: () => useAccessStore().storeId,
        onForbidden: (action) => handleForbidden(action, () => useAccessStore().clearStore()),
      }),
    ),
  browserStoreStorage(() => (import.meta.client ? localStorage : undefined)),
);
