<script setup lang="ts">
defineProps<{
  /** Lucide icon name (e.g. 'i-lucide-scroll-text'). */
  icon: string
  /** Primary message text. */
  title: string
  /** Secondary description text. */
  description?: string
  /** Tailwind color class for the icon. Defaults to 'text-muted'. */
  iconClass?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16">
    <UIcon
      :name="icon"
      :class="['size-12 mb-3', iconClass ?? 'text-muted']"
    />
    <p class="text-highlighted font-medium">
      {{ title }}
    </p>
    <p
      v-if="description"
      class="text-sm text-muted"
    >
      {{ description }}
    </p>
  </div>
</template>
