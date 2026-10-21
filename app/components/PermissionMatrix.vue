<script setup lang="ts">
import AppBadge from './AppBadge.vue';
import AppSwitch from './AppSwitch.vue';
import { PERMISSION_ORDER } from '../utils/team';
import type { Permission } from '../utils/permissions';

/**
 * The switches of what an employee may do, one row per permission as in the design. Deleting is
 * blocked by default and says so. The texts arrive translated.
 */
const props = defineProps<{
  modelValue: Record<Permission, boolean>;
  /** The name of each permission. */
  labels: Record<Permission, string>;
  /** The note beside the permission that starts blocked ("Blocked by default"). */
  blockedNote: string;
  /** Not toggleable, e.g. while saving. */
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: Record<Permission, boolean>] }>();

function set(permission: Permission, value: boolean) {
  emit('update:modelValue', { ...props.modelValue, [permission]: value });
}
</script>

<template>
  <div class="perm-list">
    <div v-for="permission in PERMISSION_ORDER" :key="permission" class="perm">
      <span>
        {{ labels[permission] }}
        <AppBadge v-if="permission === 'can_delete'">{{ blockedNote }}</AppBadge>
      </span>
      <AppSwitch
        :model-value="modelValue[permission]"
        :disabled="disabled"
        :aria-label="labels[permission]"
        @update:model-value="(value: boolean) => set(permission, value)"
      />
    </div>
  </div>
</template>
