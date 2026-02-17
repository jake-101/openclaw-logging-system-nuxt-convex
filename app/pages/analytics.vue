<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import { Bar, Doughnut, Line } from 'vue-chartjs'

definePageMeta({ title: 'Analytics' })

// Single server-side aggregate -- replaces sessions.list + logs.list subscriptions.
// No raw rows transferred over the WebSocket; all aggregation happens on the server.
const { data: analytics, isLoading: isPending } = useConvexQuery(api.analytics.summary, {})

// --- Cost over time (pre-sorted by session start time on the server) ---
const costChartData = computed(() => {
  const timeline = analytics.value?.costTimeline
  if (!timeline?.length) return null
  return {
    labels: timeline.map(t => t.date),
    datasets: [{
      label: 'Cost (USD)',
      data: timeline.map(t => t.cost),
      borderColor: 'rgb(34, 197, 94)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
      tension: 0.3
    }]
  }
})

// --- Token usage by session (pre-sorted on server) ---
const tokenChartData = computed(() => {
  const timeline = analytics.value?.tokenTimeline
  if (!timeline?.length) return null
  return {
    labels: timeline.map(t => t.sessionKey),
    datasets: [{
      label: 'Tokens',
      data: timeline.map(t => t.tokens),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderRadius: 4
    }]
  }
})

// --- Tool usage chart (top 10) ---
const toolChartData = computed(() => {
  const tools = analytics.value?.toolStats
  if (!tools?.length) return null
  const top = tools.slice(0, 10)
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

// --- Log level distribution doughnut ---
const levelDistribution = computed(() => {
  const dist = analytics.value?.levelDistribution
  if (!dist) return null
  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  if (!total) return null
  return {
    labels: ['Debug', 'Info', 'Warn', 'Error'],
    datasets: [{
      data: [dist.debug ?? 0, dist.info ?? 0, dist.warn ?? 0, dist.error ?? 0],
      backgroundColor: [
        'rgba(148, 163, 184, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(234, 179, 8, 0.7)',
        'rgba(239, 68, 68, 0.7)'
      ]
    }]
  }
})

const { line: lineOptions, bar: barOptions, doughnut: doughnutOptions } = useChartOptions()
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Summary Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        :value="`$${(analytics?.totalCost ?? 0).toFixed(4)}`"
        label="Total Cost"
        icon="i-lucide-dollar-sign"
        icon-class="text-green-500"
        :loading="isPending"
      />
      <StatCard
        :value="(analytics?.totalTokens ?? 0).toLocaleString()"
        label="Total Tokens"
        icon="i-lucide-hash"
        icon-class="text-blue-500"
        :loading="isPending"
      />
      <StatCard
        :value="(analytics?.totalToolCalls ?? 0).toLocaleString()"
        label="Total Tool Calls"
        icon="i-lucide-wrench"
        icon-class="text-purple-500"
        :loading="isPending"
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
    <UCard v-if="analytics?.toolStats?.length">
      <template #header>
        <h3 class="font-semibold text-highlighted">
          Tool Performance
        </h3>
      </template>
      <UTable
        :data="analytics.toolStats"
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
