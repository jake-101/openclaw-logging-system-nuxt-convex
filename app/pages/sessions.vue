<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'

definePageMeta({ title: 'Sessions' })

const { data: sessions } = useConvexQuery(api.sessions.list, { limit: 100 })

const columns = [
  { accessorKey: 'sessionKey', header: 'Session' },
  { accessorKey: 'agentId', header: 'Agent' },
  { accessorKey: 'kind', header: 'Kind' },
  { accessorKey: 'messageCount', header: 'Messages' },
  { accessorKey: 'toolCalls', header: 'Tool Calls' },
  { accessorKey: 'errors', header: 'Errors' },
  { accessorKey: 'estimatedCost', header: 'Cost' },
  { accessorKey: 'lastActiveAt', header: 'Last Active' }
]
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center justify-between">
      <UBadge
        v-if="sessions"
        :label="`${sessions.length} sessions`"
        variant="subtle"
        color="neutral"
      />
    </div>

    <UTable
      :data="sessions ?? []"
      :columns="columns"
      :loading="!sessions"
      class="w-full"
    >
      <template #sessionKey-cell="{ row }">
        <div class="flex items-center gap-2">
          <span
            class="size-2 rounded-full shrink-0"
            :class="isSessionActive(row.original.lastActiveAt) ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'"
          />
          <NuxtLink
            :to="`/session-${row.original.sessionKey}`"
            class="font-mono text-sm text-primary hover:underline"
          >
            {{ row.original.sessionKey }}
          </NuxtLink>
        </div>
      </template>

      <template #agentId-cell="{ row }">
        <span class="font-mono text-xs">{{ row.original.agentId }}</span>
      </template>

      <template #kind-cell="{ row }">
        <UBadge
          :label="row.original.kind"
          variant="subtle"
          color="neutral"
          size="xs"
        />
      </template>

      <template #messageCount-cell="{ row }">
        <span class="font-mono text-sm">{{ row.original.messageCount }}</span>
      </template>

      <template #toolCalls-cell="{ row }">
        <span class="font-mono text-sm">{{ row.original.toolCalls }}</span>
      </template>

      <template #errors-cell="{ row }">
        <UBadge
          v-if="row.original.errors > 0"
          :label="String(row.original.errors)"
          color="error"
          variant="subtle"
          size="xs"
        />
        <span
          v-else
          class="text-muted text-sm"
        >0</span>
      </template>

      <template #estimatedCost-cell="{ row }">
        <span class="font-mono text-xs">{{ formatCost(row.original.estimatedCost) }}</span>
      </template>

      <template #lastActiveAt-cell="{ row }">
        <div class="flex flex-col text-xs">
          <span class="text-highlighted">{{ formatFullTimestamp(row.original.lastActiveAt) }}</span>
          <span class="text-muted">
            {{ formatDuration(row.original.startedAt, row.original.lastActiveAt) }} duration
          </span>
        </div>
      </template>
    </UTable>

    <EmptyState
      v-if="sessions && sessions.length === 0"
      icon="i-lucide-activity"
      title="No sessions found."
      description="Start an agent session to see it here."
    />
  </div>
</template>
