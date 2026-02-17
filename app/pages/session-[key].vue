<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'

definePageMeta({ title: 'Session Detail' })

const route = useRoute()
const sessionKey = computed(() => route.params.key as string)

const { data: session } = useConvexQuery(api.sessions.get, computed(() => ({
  sessionKey: sessionKey.value
})))

const { data: logs } = useConvexQuery(api.logs.list, computed(() => ({
  sessionKey: sessionKey.value,
  limit: 500
})))

const { data: errors } = useConvexQuery(api.errors.bySession, computed(() => ({
  sessionKey: sessionKey.value
})))

const sortedLogs = computed(() => {
  if (!logs.value) return []
  return [...logs.value].reverse()
})
</script>

<template>
  <div class="flex flex-col h-full gap-6">
    <!-- Back link -->
    <div>
      <UButton
        label="Back to Sessions"
        variant="link"
        icon="i-lucide-arrow-left"
        to="/sessions"
        size="sm"
      />
    </div>

    <!-- Session Overview -->
    <UCard v-if="session">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-highlighted">
              Session: {{ sessionKey }}
            </h2>
            <UBadge
              :label="session.kind"
              variant="subtle"
              color="neutral"
              size="sm"
            />
          </div>
          <span class="text-sm text-muted font-mono">{{ session.agentId }}</span>
        </div>
      </template>

      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <div>
          <p class="text-xs text-muted">
            Messages
          </p>
          <p class="text-lg font-bold text-highlighted">
            {{ session.messageCount }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            Tool Calls
          </p>
          <p class="text-lg font-bold text-highlighted">
            {{ session.toolCalls }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            Errors
          </p>
          <p
            class="text-lg font-bold"
            :class="session.errors > 0 ? 'text-red-500' : 'text-highlighted'"
          >
            {{ session.errors }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            Tokens
          </p>
          <p class="text-lg font-bold text-highlighted">
            {{ session.totalTokens?.toLocaleString() ?? '—' }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            Cost
          </p>
          <p class="text-lg font-bold text-highlighted">
            {{ formatCost(session.estimatedCost) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            Duration
          </p>
          <p class="text-lg font-bold text-highlighted">
            {{ formatDuration(session.startedAt, session.lastActiveAt) }}
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-4 text-xs text-muted">
          <span>Started: {{ formatFullTimestamp(session.startedAt) }}</span>
          <span>Last active: {{ formatFullTimestamp(session.lastActiveAt) }}</span>
        </div>
      </template>
    </UCard>

    <!-- Errors for this session -->
    <UCard v-if="errors && errors.length > 0">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-5 text-red-500"
          />
          <h3 class="font-semibold text-highlighted">
            Errors ({{ errors.length }})
          </h3>
        </div>
      </template>

      <div class="space-y-3">
        <div
          v-for="error in errors"
          :key="error._id"
          class="border border-red-200 dark:border-red-900 rounded-lg p-3"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-medium text-sm text-red-600 dark:text-red-400">{{ error.errorType }}</span>
            <div class="flex items-center gap-2">
              <UBadge
                :label="error.resolved ? 'Resolved' : 'Unresolved'"
                :color="error.resolved ? 'success' : 'error'"
                variant="subtle"
                size="xs"
              />
              <span class="text-xs text-muted">{{ formatTimestamp(error.timestamp) }}</span>
            </div>
          </div>
          <p class="text-sm text-highlighted">
            {{ error.message }}
          </p>
          <UCollapsible
            v-if="error.stack"
            class="mt-2"
          >
            <UButton
              label="Stack trace"
              variant="link"
              size="xs"
              icon="i-lucide-code"
            />
            <template #content>
              <pre class="text-xs font-mono text-muted bg-neutral-50 dark:bg-neutral-900 p-3 rounded mt-1 overflow-x-auto">{{ error.stack }}</pre>
            </template>
          </UCollapsible>
        </div>
      </div>
    </UCard>

    <!-- Log Timeline -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-highlighted">
            Log Timeline
          </h3>
          <UBadge
            :label="`${sortedLogs.length} entries`"
            variant="subtle"
            color="neutral"
          />
        </div>
      </template>

      <div
        v-if="sortedLogs.length"
        class="space-y-1"
      >
        <div
          v-for="log in sortedLogs"
          :key="log._id"
          class="flex items-start gap-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
        >
          <span class="font-mono text-xs text-muted shrink-0 mt-0.5 w-20">
            {{ formatTimestamp(log.timestamp) }}
          </span>
          <UBadge
            :label="log.level"
            :color="LOG_LEVEL_COLORS[log.level] || 'neutral'"
            variant="subtle"
            size="xs"
            class="w-14 justify-center shrink-0 mt-0.5"
          />
          <span class="text-sm text-highlighted flex-1 min-w-0">
            {{ log.message }}
          </span>
          <UBadge
            v-if="log.toolName"
            :label="log.toolName"
            variant="outline"
            size="xs"
            class="shrink-0"
          />
        </div>
      </div>

      <EmptyState
        v-else-if="logs"
        icon="i-lucide-scroll-text"
        title="No logs for this session yet."
      />
    </UCard>
  </div>
</template>
