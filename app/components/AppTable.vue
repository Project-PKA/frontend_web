<script setup lang="ts" generic="Row extends object">
export interface TableColumn {
  key: string;
  label: string;
  /** Right-aligned, monospaced digits (amounts, counts). */
  numeric?: boolean;
}

defineProps<{
  /** Names the table for screen readers; it is not shown. */
  caption: string;
  columns: TableColumn[];
  rows: Row[];
  rowKey: (row: Row) => string;
}>();

function valueOf(row: Row, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
</script>

<template>
  <div class="table-wrap">
    <table class="table">
      <caption class="visually-hidden">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="{ num: column.numeric }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="rowKey(row)">
          <!-- data-label is what the design shows in front of each value on small screens -->
          <td
            v-for="column in columns"
            :key="column.key"
            :data-label="column.label"
            :class="{ num: column.numeric }"
          >
            <slot :name="`cell-${column.key}`" :row="row" :value="valueOf(row, column.key)">
              {{ valueOf(row, column.key) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
