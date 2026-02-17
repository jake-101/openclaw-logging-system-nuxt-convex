<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'

const levelFilter = ref('all')
const sessionFilter = ref('')
const tailMode = ref(true)
const logLimit = ref(200)

const queryArgs = computed(() => {
  const args: Record<string, unknown> = { limit: logLimit.value }
  if (levelFilter.value && levelFilter.value !== 'all') {
    args.level = levelFilter.value
  }
  if (sessionFilter.value.trim()) {
    args.sessionKey = sessionFilter.value.trim()
  }
  return args
})

const { data: logs } = useConvexQuery(api.logs.list, queryArgs)

const sortedLogs = computed(() => {
  if (!logs.value) return []
  // logs come desc from Convex, reverse for chronological (tail mode shows newest at bottom)
  return [...logs.value].reverse()
})

const levelOptions = [
  { label: 'All Levels', value: 'all' },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' }
]

const levelColors: Record<string, 'neutral' | 'primary' | 'warning' | 'error'> = {
  debug: 'neutral',
  info: 'primary',
  warn: 'warning',
  error: 'error'
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

// Auto-scroll to bottom when in tail mode
const logContainer = ref<HTMLElement | null>(null)

watch(sortedLogs, () => {
  if (tailMode.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
})

const columns = [
  { accessorKey: 'timestamp', header: 'Time' },
  { accessorKey: 'level', header: 'Level' },
  { accessorKey: 'agentId', header: 'Agent' },
  { accessorKey: 'sessionKey', header: 'Session' },
  { accessorKey: 'message', header: 'Message' },
  { accessorKey: 'toolName', header: 'Tool' }
]
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <USelect
        v-model="levelFilter"
        :items="levelOptions"
        class="w-36"
      />

      <UInput
        v-model="sessionFilter"
        placeholder="Filter by session key..."
        icon="i-lucide-search"
        class="w-64"
      />

      <div class="flex items-center gap-2 ml-auto">
        <USwitch
          v-model="tailMode"
          label="Tail mode"
        />

        <UBadge
          :label="`${sortedLogs.length} entries`"
          variant="subtle"
          color="neutral"
        />
      </div>
    </div>

    <!-- Log Table -->
    <div
      ref="logContainer"
      class="flex-1 overflow-auto min-h-0"
    >
      <UTable
        :data="sortedLogs"
        :columns="columns"
        :loading="!logs"
        class="w-full"
      >
        <template #timestamp-cell="{ row }">
          <div class="flex flex-col text-xs">
            <span class="text-muted">{{ formatDate(row.original.timestamp) }}</span>
            <span class="font-mono text-highlighted">{{ formatTimestamp(row.original.timestamp) }}</span>
          </div>
        </template>

        <template #level-cell="{ row }">
          <UBadge
            :label="row.original.level"
            :color="levelColors[row.original.level] || 'neutral'"
            variant="subtle"
            size="xs"
            class="w-14 justify-center"
          />
        </template>

        <template #agentId-cell="{ row }">
          <span class="font-mono text-xs">{{ row.original.agentId }}</span>
        </template>

        <template #sessionKey-cell="{ row }">
          <NuxtLink
            :to="`/session-${row.original.sessionKey}`"
            class="font-mono text-xs text-primary hover:underline"
          >
            {{ row.original.sessionKey }}
          </NuxtLink>
        </template>

        <template #message-cell="{ row }">
          <span class="text-sm text-highlighted">{{ row.original.message }}</span>
        </template>

        <template #toolName-cell="{ row }">
          <template v-if="row.original.toolName">
            <UBadge
              :label="row.original.toolName"
              variant="outline"
              size="xs"
            />
            <span
              v-if="row.original.toolDuration"
              class="text-xs text-muted ml-1"
            >
              {{ row.original.toolDuration }}ms
            </span>
          </template>
          <span
            v-else
            class="text-muted text-xs"
          >—</span>
        </template>
      </UTable>

      <div
        v-if="sortedLogs.length === 0 && logs"
        class="flex flex-col items-center justify-center py-16"
      >
        <UIcon
          name="i-lucide-scroll-text"
          class="size-12 text-muted mb-3"
        />
        <p class="text-muted">
          No log entries found.
        </p>
        <p class="text-sm text-muted">
          Start an agent session to see activity here.
        </p>
      </div>
    </div>
  </div>
</template>
