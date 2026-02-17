<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'

const { data: sessions } = useConvexQuery(api.sessions.list, { limit: 50 })
const { data: recentLogs } = useConvexQuery(api.logs.list, { limit: 10 })
const { data: unresolvedErrors } = useConvexQuery(api.errors.unresolved, {})

const totalSessions = computed(() => sessions.value?.length ?? 0)
const totalErrors = computed(() => unresolvedErrors.value?.length ?? 0)
const recentLogCount = computed(() => recentLogs.value?.length ?? 0)

const activeSessions = computed(() => {
  if (!sessions.value) return 0
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return sessions.value.filter(s => s.lastActiveAt > fiveMinutesAgo).length
})

const stats = computed(() => [
  {
    label: 'Active Sessions',
    value: activeSessions.value,
    icon: 'i-lucide-activity',
    color: 'text-green-500' as const
  },
  {
    label: 'Total Sessions',
    value: totalSessions.value,
    icon: 'i-lucide-layers',
    color: 'text-blue-500' as const
  },
  {
    label: 'Unresolved Errors',
    value: totalErrors.value,
    icon: 'i-lucide-alert-triangle',
    color: totalErrors.value > 0 ? 'text-red-500' as const : 'text-muted' as const
  },
  {
    label: 'Recent Logs',
    value: recentLogCount.value,
    icon: 'i-lucide-scroll-text',
    color: 'text-muted' as const
  }
])

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

const levelColors: Record<string, string> = {
  debug: 'neutral',
  info: 'primary',
  warn: 'warning',
  error: 'error'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard
        v-for="stat in stats"
        :key="stat.label"
      >
        <div class="flex items-center gap-3">
          <UIcon
            :name="stat.icon"
            :class="['size-8', stat.color]"
          />
          <div>
            <p class="text-2xl font-bold text-highlighted">
              {{ stat.value }}
            </p>
            <p class="text-sm text-muted">
              {{ stat.label }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent Logs -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-highlighted">
              Recent Logs
            </h3>
            <UButton
              label="View all"
              variant="link"
              to="/logs"
              trailing-icon="i-lucide-arrow-right"
              size="sm"
            />
          </div>
        </template>

        <div
          v-if="recentLogs?.length"
          class="space-y-2"
        >
          <div
            v-for="log in recentLogs"
            :key="log._id"
            class="flex items-start gap-2 text-sm"
          >
            <UBadge
              :label="log.level"
              :color="levelColors[log.level] || 'neutral'"
              variant="subtle"
              size="xs"
              class="mt-0.5 shrink-0 w-14 justify-center"
            />
            <span class="text-muted shrink-0 text-xs mt-0.5">
              {{ formatTimestamp(log.timestamp) }}
            </span>
            <span class="text-highlighted truncate">
              {{ log.message }}
            </span>
          </div>
        </div>
        <p
          v-else
          class="text-muted text-sm"
        >
          No logs yet. Start an agent session to see activity.
        </p>
      </UCard>

      <!-- Unresolved Errors -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-highlighted">
              Unresolved Errors
            </h3>
            <UButton
              label="View all"
              variant="link"
              to="/errors"
              trailing-icon="i-lucide-arrow-right"
              size="sm"
            />
          </div>
        </template>

        <div
          v-if="unresolvedErrors?.length"
          class="space-y-3"
        >
          <div
            v-for="error in unresolvedErrors.slice(0, 5)"
            :key="error._id"
            class="flex items-start gap-2 text-sm"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="size-4 text-red-500 mt-0.5 shrink-0"
            />
            <div class="min-w-0">
              <p class="font-medium text-highlighted truncate">
                {{ error.errorType }}
              </p>
              <p class="text-muted truncate">
                {{ error.message }}
              </p>
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-muted text-sm"
        >
          No unresolved errors.
        </p>
      </UCard>
    </div>
  </div>
</template>
