<script setup lang="ts">
/**
 * A legal text as a page: a heading, a notice that the text is still to be reviewed, and numbered
 * sections. It only shows what it is given (the texts arrive translated).
 */
defineProps<{
  title: string;
  /** "Illustrative text, pending legal review." */
  notice: string;
  sections: { title: string; text: string }[];
  /** The other legal page, linked under the title. */
  other: { label: string; to: string };
}>();
</script>

<template>
  <main id="main">
    <div class="wrap legal">
      <div class="stack legal__head">
        <h1>{{ title }}</h1>
        <p class="faint legal__notice" role="note">
          {{ notice }} ·
          <NuxtLink :to="other.to">{{ other.label }}</NuxtLink>
        </p>
      </div>
      <article class="card legal__body">
        <section
          v-for="(section, index) in sections"
          :key="section.title"
          class="stack legal__section"
          :aria-labelledby="`legal-${index}`"
        >
          <h2 :id="`legal-${index}`">{{ index + 1 }}. {{ section.title }}</h2>
          <p>{{ section.text }}</p>
        </section>
      </article>
    </div>
  </main>
</template>
