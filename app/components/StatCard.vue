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
  /** Show skeleton loading state instead of value. */
  loading?: boolean
}>()
</script>

<template>
  <UCard>
    <div class="flex items-center gap-3">
      <USkeleton
        v-if="loading"
        class="size-8 rounded-md shrink-0"
      />
      <UIcon
        v-else
        :name="icon"
        :class="['size-8', iconClass ?? 'text-muted']"
      />
      <div class="flex-1 min-w-0">
        <USkeleton
          v-if="loading"
          class="h-7 w-16 mb-1"
        />
        <p
          v-else
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
