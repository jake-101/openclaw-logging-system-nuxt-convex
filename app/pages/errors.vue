<script setup lang="ts">
import { useConvexQuery, useConvexMutation } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import type { Id } from '#convex/_generated/dataModel'

const { data: unresolvedErrors } = useConvexQuery(api.errors.unresolved, {})

const { mutate: markResolved, isLoading: isResolving } = useConvexMutation(api.errors.markResolved)

const toast = useToast()

// Group errors by errorType
const groupedErrors = computed(() => {
  if (!unresolvedErrors.value) return []
  const groups = new Map<string, typeof unresolvedErrors.value>()

  for (const error of unresolvedErrors.value) {
    const existing = groups.get(error.errorType) ?? []
    existing.push(error)
    groups.set(error.errorType, existing)
  }

  return Array.from(groups.entries()).map(([type, errors]) => ({
    type,
    errors,
    count: errors.length,
    latestTimestamp: Math.max(...errors.map(e => e.timestamp))
  })).sort((a, b) => b.latestTimestamp - a.latestTimestamp)
})

async function handleResolve(id: Id<'errors'>) {
  try {
    await markResolved({ id })
    toast.add({
      title: 'Error resolved',
      color: 'success'
    })
  } catch (e) {
    toast.add({
      title: 'Failed to resolve error',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error'
    })
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <!-- Summary bar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UBadge
          v-if="unresolvedErrors"
          :label="`${unresolvedErrors.length} unresolved`"
          :color="unresolvedErrors.length > 0 ? 'error' : 'success'"
          variant="subtle"
        />
        <UBadge
          v-if="groupedErrors.length"
          :label="`${groupedErrors.length} types`"
          variant="subtle"
          color="neutral"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="unresolvedErrors && unresolvedErrors.length === 0"
      class="flex flex-col items-center justify-center py-16"
    >
      <UIcon
        name="i-lucide-check-circle"
        class="size-12 text-green-500 mb-3"
      />
      <p class="text-highlighted font-medium">
        No unresolved errors
      </p>
      <p class="text-sm text-muted">
        All errors have been resolved. Nice work!
      </p>
    </div>

    <!-- Grouped errors -->
    <div
      v-else
      class="space-y-4"
    >
      <UCard
        v-for="group in groupedErrors"
        :key="group.type"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon
                name="i-lucide-alert-circle"
                class="size-5 text-red-500"
              />
              <h3 class="font-semibold text-highlighted">
                {{ group.type }}
              </h3>
              <UBadge
                :label="String(group.count)"
                color="error"
                variant="subtle"
                size="xs"
              />
            </div>
            <span class="text-xs text-muted">
              Latest: {{ formatRelativeTime(group.latestTimestamp) }}
            </span>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="error in group.errors"
            :key="error._id"
            class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm text-highlighted mb-1">
                  {{ error.message }}
                </p>
                <div class="flex items-center gap-3 text-xs text-muted">
                  <span>{{ formatTimestamp(error.timestamp) }}</span>
                  <NuxtLink
                    :to="`/session-${error.sessionKey}`"
                    class="font-mono text-primary hover:underline"
                  >
                    {{ error.sessionKey }}
                  </NuxtLink>
                </div>
              </div>
              <UButton
                label="Resolve"
                color="success"
                variant="soft"
                size="xs"
                icon="i-lucide-check"
                :loading="isResolving"
                @click="handleResolve(error._id)"
              />
            </div>

            <!-- Expandable stack trace -->
            <UCollapsible
              v-if="error.stack"
              class="mt-3"
            >
              <UButton
                label="Stack trace"
                variant="link"
                size="xs"
                icon="i-lucide-code"
              />
              <template #content>
                <pre class="text-xs font-mono text-muted bg-neutral-50 dark:bg-neutral-900 p-3 rounded mt-2 overflow-x-auto whitespace-pre-wrap break-all">{{ error.stack }}</pre>
              </template>
            </UCollapsible>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
