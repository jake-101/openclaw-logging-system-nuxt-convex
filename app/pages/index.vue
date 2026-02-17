<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'

definePageMeta({ title: 'Dashboard' })

// Single snapshot query replaces 4 separate subscriptions (logs.list,
// logs.countToday, sessions.list, errors.unresolved). Each log write now
// triggers one re-execution instead of four.
const { data: snapshot, isLoading } = useConvexQuery(api.dashboard.snapshot, {})

const recentLogs = computed(() => snapshot.value?.recentLogs ?? [])
const unresolvedErrors = computed(() => snapshot.value?.unresolvedErrors ?? [])
const sessions = computed(() => snapshot.value?.recentSessions ?? [])
const logsToday = computed(() => snapshot.value?.logsToday ?? 0)

const totalSessions = computed(() => sessions.value.length)
const totalErrors = computed(() => unresolvedErrors.value.length)

const activeSessions = computed(() =>
  sessions.value.filter(s => isSessionActive(s.lastActiveAt)).length
)

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
    label: 'Logs Today',
    value: logsToday.value,
    icon: 'i-lucide-scroll-text',
    color: 'text-muted' as const
  }
])
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :value="stat.value"
        :label="stat.label"
        :icon="stat.icon"
        :icon-class="stat.color"
        :loading="isLoading"
      />
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
          v-if="isLoading"
          class="space-y-2"
        >
          <div
            v-for="n in 5"
            :key="n"
            class="flex items-start gap-2"
          >
            <USkeleton class="h-5 w-14 shrink-0" />
            <USkeleton class="h-5 w-24 shrink-0" />
            <USkeleton class="h-5 flex-1" />
          </div>
        </div>

        <div
          v-else-if="recentLogs.length"
          class="space-y-2"
        >
          <div
            v-for="log in recentLogs"
            :key="log._id"
            class="flex items-start gap-2 text-sm"
          >
            <UBadge
              :label="log.level"
              :color="LOG_LEVEL_COLORS[log.level] || 'neutral'"
              variant="subtle"
              size="xs"
              class="mt-0.5 shrink-0 w-14 justify-center"
            />
            <span class="text-muted shrink-0 text-xs mt-0.5">
              {{ formatFullTimestamp(log.timestamp) }}
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
          v-if="isLoading"
          class="space-y-3"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="flex items-start gap-2"
          >
            <USkeleton class="size-4 shrink-0 mt-0.5" />
            <div class="flex-1 space-y-1">
              <USkeleton class="h-4 w-32" />
              <USkeleton class="h-3 w-48" />
            </div>
          </div>
        </div>

        <div
          v-else-if="unresolvedErrors.length"
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
