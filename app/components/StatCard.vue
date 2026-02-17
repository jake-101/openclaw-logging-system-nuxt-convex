<script setup lang="ts">
defineProps<{
  /** Display value (number, string, or formatted text). */
  value: string | number
  /** Label displayed below the value. */
  label: string
  /** Lucide icon name (e.g. 'i-lucide-activity'). */
  icon: string
  /** Tailwind color class for the icon (e.g. 'text-green-500'). */
  iconClass?: string
  /** Tailwind color class for the value text. Defaults to 'text-highlighted'. */
  valueClass?: string
}>()
</script>

<template>
  <UCard>
    <div class="flex items-center gap-3">
      <UIcon
        :name="icon"
        :class="['size-8', iconClass ?? 'text-muted']"
      />
      <div>
        <p
          class="text-2xl font-bold"
          :class="valueClass ?? 'text-highlighted'"
        >
          {{ value }}
        </p>
        <p class="text-sm text-muted">
          {{ label }}
        </p>
      </div>
    </div>
  </UCard>
</template>
