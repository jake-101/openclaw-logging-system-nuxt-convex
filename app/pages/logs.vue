<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'

definePageMeta({ title: 'Logs' })

const levelFilter = ref('all')
const sessionFilter = ref('')
const searchInput = ref('')
const searchTerm = refDebounced(searchInput, 300)
const logLimit = ref(200)

const isSearching = computed(() => searchTerm.value.trim().length > 0)

// Standard list query args (used when not searching)
const listArgs = computed(() => {
  const args: {
    limit: number
    level?: 'debug' | 'info' | 'warn' | 'error'
    sessionKey?: string
  } = { limit: logLimit.value }
  if (levelFilter.value && levelFilter.value !== 'all') {
    args.level = levelFilter.value as 'debug' | 'info' | 'warn' | 'error'
  }
  if (sessionFilter.value.trim()) {
    args.sessionKey = sessionFilter.value.trim()
  }
  return args
})

// Search query args (used when searching)
const searchQueryArgs = computed(() => {
  const args: {
    searchTerm: string
    limit: number
    level?: 'debug' | 'info' | 'warn' | 'error'
    sessionKey?: string
  } = {
    searchTerm: searchTerm.value.trim() || '',
    limit: logLimit.value
  }
  if (levelFilter.value && levelFilter.value !== 'all') {
    args.level = levelFilter.value as 'debug' | 'info' | 'warn' | 'error'
  }
  if (sessionFilter.value.trim()) {
    args.sessionKey = sessionFilter.value.trim()
  }
  return args
})

const { data: listLogs, isLoading: listPending } = useConvexQuery(api.logs.list, listArgs)
// Only subscribe to search when actively searching -- avoids double server load on every log write
const { data: searchLogs, isLoading: searchPending } = useConvexQuery(
  api.logs.search,
  searchQueryArgs,
  { enabled: isSearching }
)

const isPending = computed(() => isSearching.value ? searchPending.value : listPending.value)

const activeLogs = computed(() => {
  if (isSearching.value) return searchLogs.value
  return listLogs.value
})

const levelOptions = [
  { label: 'All Levels', value: 'all' },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' }
]

// All possible columns
const allColumns = [
  { accessorKey: 'timestamp', header: 'Time', id: 'timestamp' },
  { accessorKey: 'level', header: 'Level', id: 'level' },
  { accessorKey: 'agentId', header: 'Agent', id: 'agentId' },
  { accessorKey: 'sessionKey', header: 'Session', id: 'sessionKey' },
  { accessorKey: 'message', header: 'Message', id: 'message' },
  { accessorKey: 'toolName', header: 'Tool', id: 'toolName' },
  { accessorKey: 'toolDuration', header: 'Duration', id: 'toolDuration' },
  { accessorKey: 'toolSuccess', header: 'Success', id: 'toolSuccess' },
  { accessorKey: 'model', header: 'Model', id: 'model' },
  { accessorKey: 'channel', header: 'Channel', id: 'channel' }
]

const defaultVisible = ['timestamp', 'level', 'agentId', 'sessionKey', 'message', 'toolName']
const visibleColumnIds = ref<string[]>([...defaultVisible])

const columnOptions = allColumns.map(c => ({
  label: c.header,
  value: c.id
}))

const visibleColumns = computed(() =>
  allColumns.filter(c => visibleColumnIds.value.includes(c.id))
)
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
        v-model="searchInput"
        placeholder="Search logs..."
        icon="i-lucide-search"
        class="w-64"
        :trailing-icon="isSearching ? 'i-lucide-loader' : undefined"
      />

      <UInput
        v-model="sessionFilter"
        placeholder="Session key..."
        icon="i-lucide-filter"
        class="w-48"
      />

      <div class="flex items-center gap-2 ml-auto">
        <UPopover>
          <UButton
            icon="i-lucide-columns-3"
            label="Columns"
            variant="outline"
            size="sm"
          />

          <template #content>
            <div class="p-3 w-48 space-y-2">
              <p class="text-xs font-medium text-muted mb-2">
                Visible Columns
              </p>
              <label
                v-for="col in columnOptions"
                :key="col.value"
                class="flex items-center gap-2 text-sm cursor-pointer"
              >
                <UCheckbox
                  :model-value="visibleColumnIds.includes(col.value)"
                  @update:model-value="
                    $event
                      ? visibleColumnIds.push(col.value)
                      : visibleColumnIds = visibleColumnIds.filter(id => id !== col.value)
                  "
                />
                {{ col.label }}
              </label>
            </div>
          </template>
        </UPopover>

        <UBadge
          :label="`${activeLogs?.length ?? 0} entries`"
          variant="subtle"
          color="neutral"
        />
      </div>
    </div>

    <!-- Log Table -->
    <div class="flex-1 overflow-auto min-h-0">
      <UTable
        :data="activeLogs ?? []"
        :columns="visibleColumns"
        :loading="isPending"
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
            :color="LOG_LEVEL_COLORS[row.original.level] || 'neutral'"
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
          </template>
          <span
            v-else
            class="text-muted text-xs"
          >—</span>
        </template>

        <template #toolDuration-cell="{ row }">
          <span
            v-if="row.original.toolDuration"
            class="font-mono text-xs"
          >{{ row.original.toolDuration }}ms</span>
          <span
            v-else
            class="text-muted text-xs"
          >—</span>
        </template>

        <template #toolSuccess-cell="{ row }">
          <UBadge
            v-if="row.original.toolSuccess !== undefined && row.original.toolSuccess !== null"
            :label="row.original.toolSuccess ? 'Yes' : 'No'"
            :color="row.original.toolSuccess ? 'success' : 'error'"
            variant="subtle"
            size="xs"
          />
          <span
            v-else
            class="text-muted text-xs"
          >—</span>
        </template>

        <template #model-cell="{ row }">
          <span
            v-if="row.original.model"
            class="font-mono text-xs"
          >{{ row.original.model }}</span>
          <span
            v-else
            class="text-muted text-xs"
          >—</span>
        </template>

        <template #channel-cell="{ row }">
          <UBadge
            v-if="row.original.channel"
            :label="row.original.channel"
            variant="subtle"
            color="neutral"
            size="xs"
          />
          <span
            v-else
            class="text-muted text-xs"
          >—</span>
        </template>
      </UTable>

      <EmptyState
        v-if="activeLogs && activeLogs.length === 0"
        icon="i-lucide-scroll-text"
        :title="isSearching ? 'No logs match your search.' : 'No log entries found.'"
        :description="isSearching ? 'Try a different search term.' : 'Start an agent session to see activity here.'"
      />
    </div>
  </div>
</template>
