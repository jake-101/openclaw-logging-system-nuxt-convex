<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import { Bar, Doughnut, Line } from 'vue-chartjs'

definePageMeta({ title: 'Analytics' })

const { data: sessions } = useConvexQuery(api.sessions.list, { limit: 50 })
const { data: logs } = useConvexQuery(api.logs.list, { limit: 100 })

// --- Cost over time (by session, sorted by start time) ---
const costChartData = computed(() => {
  if (!sessions.value?.length) return null
  const sorted = [...sessions.value]
    .filter(s => s.estimatedCost !== undefined && s.estimatedCost !== null)
    .sort((a, b) => a.startedAt - b.startedAt)

  if (!sorted.length) return null

  return {
    labels: sorted.map(s => new Date(s.startedAt).toLocaleDateString()),
    datasets: [{
      label: 'Cost (USD)',
      data: sorted.map(s => s.estimatedCost ?? 0),
      borderColor: 'rgb(34, 197, 94)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
      tension: 0.3
    }]
  }
})

// --- Token usage by session ---
const tokenChartData = computed(() => {
  if (!sessions.value?.length) return null
  const sorted = [...sessions.value]
    .filter(s => s.totalTokens !== undefined && s.totalTokens !== null && s.totalTokens > 0)
    .sort((a, b) => a.startedAt - b.startedAt)

  if (!sorted.length) return null

  return {
    labels: sorted.map(s => s.sessionKey.length > 16 ? `${s.sessionKey.slice(0, 16)}...` : s.sessionKey),
    datasets: [{
      label: 'Tokens',
      data: sorted.map(s => s.totalTokens ?? 0),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderRadius: 4
    }]
  }
})

// --- Tool performance (from logs with toolName) ---
const toolStats = computed(() => {
  if (!logs.value?.length) return []
  const tools = new Map<string, { total: number, success: number, totalDuration: number, count: number }>()

  for (const log of logs.value) {
    if (!log.toolName) continue
    const existing = tools.get(log.toolName) ?? { total: 0, success: 0, totalDuration: 0, count: 0 }
    existing.total++
    if (log.toolSuccess) existing.success++
    if (log.toolDuration) {
      existing.totalDuration += log.toolDuration
      existing.count++
    }
    tools.set(log.toolName, existing)
  }

  return Array.from(tools.entries())
    .map(([name, stats]) => ({
      name,
      calls: stats.total,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0
    }))
    .sort((a, b) => b.calls - a.calls)
})

const toolChartData = computed(() => {
  if (!toolStats.value.length) return null
  const top = toolStats.value.slice(0, 10)
  return {
    labels: top.map(t => t.name),
    datasets: [{
      label: 'Calls',
      data: top.map(t => t.calls),
      backgroundColor: 'rgba(139, 92, 246, 0.7)',
      borderRadius: 4
    }]
  }
})

// --- Log level distribution ---
const levelDistribution = computed(() => {
  if (!logs.value?.length) return null
  const counts: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0 }
  for (const log of logs.value) {
    counts[log.level] = (counts[log.level] ?? 0) + 1
  }
  return {
    labels: ['Debug', 'Info', 'Warn', 'Error'],
    datasets: [{
      data: [counts.debug ?? 0, counts.info ?? 0, counts.warn ?? 0, counts.error ?? 0],
      backgroundColor: [
        'rgba(148, 163, 184, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(234, 179, 8, 0.7)',
        'rgba(239, 68, 68, 0.7)'
      ]
    }]
  }
})

// --- Summary stats ---
const totalCost = computed(() => {
  if (!sessions.value) return 0
  return sessions.value.reduce((sum, s) => sum + (s.estimatedCost ?? 0), 0)
})

const totalTokens = computed(() => {
  if (!sessions.value) return 0
  return sessions.value.reduce((sum, s) => sum + (s.totalTokens ?? 0), 0)
})

const totalToolCalls = computed(() => {
  if (!sessions.value) return 0
  return sessions.value.reduce((sum, s) => sum + s.toolCalls, 0)
})

const { line: lineOptions, bar: barOptions, doughnut: doughnutOptions } = useChartOptions()
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Summary Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        :value="`$${totalCost.toFixed(4)}`"
        label="Total Cost"
        icon="i-lucide-dollar-sign"
        icon-class="text-green-500"
      />
      <StatCard
        :value="totalTokens.toLocaleString()"
        label="Total Tokens"
        icon="i-lucide-hash"
        icon-class="text-blue-500"
      />
      <StatCard
        :value="totalToolCalls.toLocaleString()"
        label="Total Tool Calls"
        icon="i-lucide-wrench"
        icon-class="text-purple-500"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Cost Over Time -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Cost Over Time
          </h3>
        </template>
        <div
          v-if="costChartData"
          class="h-64"
        >
          <Line
            :data="costChartData"
            :options="lineOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No cost data available yet.
        </p>
      </UCard>

      <!-- Token Usage by Session -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Token Usage by Session
          </h3>
        </template>
        <div
          v-if="tokenChartData"
          class="h-64"
        >
          <Bar
            :data="tokenChartData"
            :options="barOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No token data available yet.
        </p>
      </UCard>

      <!-- Tool Calls Distribution -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Top Tools by Usage
          </h3>
        </template>
        <div
          v-if="toolChartData"
          class="h-64"
        >
          <Bar
            :data="toolChartData"
            :options="barOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No tool usage data yet.
        </p>
      </UCard>

      <!-- Log Level Distribution -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Log Level Distribution
          </h3>
        </template>
        <div
          v-if="levelDistribution"
          class="h-64"
        >
          <Doughnut
            :data="levelDistribution"
            :options="doughnutOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No log data yet.
        </p>
      </UCard>
    </div>

    <!-- Tool Performance Table -->
    <UCard v-if="toolStats.length">
      <template #header>
        <h3 class="font-semibold text-highlighted">
          Tool Performance
        </h3>
      </template>
      <UTable
        :data="toolStats"
        :columns="[
          { accessorKey: 'name', header: 'Tool' },
          { accessorKey: 'calls', header: 'Calls' },
          { accessorKey: 'successRate', header: 'Success Rate' },
          { accessorKey: 'avgDuration', header: 'Avg Duration' }
        ]"
      >
        <template #name-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.name }}</span>
        </template>
        <template #calls-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.calls }}</span>
        </template>
        <template #successRate-cell="{ row }">
          <UBadge
            :label="`${row.original.successRate}%`"
            :color="row.original.successRate >= 90 ? 'success' : row.original.successRate >= 70 ? 'warning' : 'error'"
            variant="subtle"
            size="xs"
          />
        </template>
        <template #avgDuration-cell="{ row }">
          <span class="font-mono text-xs text-muted">
            {{ row.original.avgDuration > 0 ? `${row.original.avgDuration}ms` : '—' }}
          </span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
