<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import { Bar, Doughnut, Line } from 'vue-chartjs'

definePageMeta({ title: 'Model Usage' })

const hoursWindow = ref(24)
const daysWindow = ref(7)

const { data: modelStats } = useConvexQuery(api.modelUsage.byModel, computed(() => ({
  hours: hoursWindow.value
})))
const { data: providerStats } = useConvexQuery(api.modelUsage.byProvider, computed(() => ({
  hours: hoursWindow.value
})))
const { data: latencyStats } = useConvexQuery(api.modelUsage.latencyStats, computed(() => ({
  hours: hoursWindow.value
})))
const { data: dailySummary } = useConvexQuery(api.modelUsage.dailySummary, computed(() => ({
  days: daysWindow.value
})))

// Summary stats
const totalCalls = computed(() => {
  if (!modelStats.value) return 0
  return Object.values(modelStats.value).reduce((sum, m) => sum + m.calls, 0)
})

const totalTokens = computed(() => {
  if (!modelStats.value) return 0
  return Object.values(modelStats.value).reduce((sum, m) => sum + m.totalTokens, 0)
})

const totalCost = computed(() => {
  if (!modelStats.value) return 0
  return Object.values(modelStats.value).reduce((sum, m) => sum + m.totalCost, 0)
})

// Model breakdown pie chart
const modelCallsChart = computed(() => {
  if (!modelStats.value || Object.keys(modelStats.value).length === 0) return null
  const entries = Object.entries(modelStats.value).sort((a, b) => b[1].calls - a[1].calls)
  const colors = [
    'rgba(34, 197, 94, 0.7)',
    'rgba(59, 130, 246, 0.7)',
    'rgba(139, 92, 246, 0.7)',
    'rgba(234, 179, 8, 0.7)',
    'rgba(239, 68, 68, 0.7)',
    'rgba(236, 72, 153, 0.7)',
    'rgba(20, 184, 166, 0.7)',
    'rgba(245, 158, 11, 0.7)'
  ]
  return {
    labels: entries.map(([model]) => model),
    datasets: [{
      data: entries.map(([, stats]) => stats.calls),
      backgroundColor: entries.map((_, i) => colors[i % colors.length])
    }]
  }
})

// Provider cost comparison bar chart
const providerCostChart = computed(() => {
  if (!providerStats.value || Object.keys(providerStats.value).length === 0) return null
  const entries = Object.entries(providerStats.value).sort((a, b) => b[1].totalCost - a[1].totalCost)
  return {
    labels: entries.map(([provider]) => provider),
    datasets: [{
      label: 'Cost (USD)',
      data: entries.map(([, stats]) => Number(stats.totalCost.toFixed(4))),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderRadius: 4
    }]
  }
})

// Daily trends line chart
const dailyTrendChart = computed(() => {
  if (!dailySummary.value || Object.keys(dailySummary.value).length === 0) return null
  const entries = Object.entries(dailySummary.value).sort((a, b) => a[0].localeCompare(b[0]))
  return {
    labels: entries.map(([day]) => day),
    datasets: [
      {
        label: 'Cost (USD)',
        data: entries.map(([, s]) => Number(s.cost.toFixed(4))),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        label: 'Tokens (K)',
        data: entries.map(([, s]) => Math.round(s.tokens / 1000)),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  }
})

// Model latency bar chart
const latencyChart = computed(() => {
  if (!modelStats.value || Object.keys(modelStats.value).length === 0) return null
  const entries = Object.entries(modelStats.value)
    .filter(([, stats]) => stats.avgLatency > 0)
    .sort((a, b) => b[1].avgLatency - a[1].avgLatency)
  if (!entries.length) return null
  return {
    labels: entries.map(([model]) => model),
    datasets: [{
      label: 'Avg Latency (ms)',
      data: entries.map(([, stats]) => stats.avgLatency),
      backgroundColor: 'rgba(139, 92, 246, 0.7)',
      borderRadius: 4
    }]
  }
})

// Model table data
const modelTableData = computed(() => {
  if (!modelStats.value) return []
  return Object.entries(modelStats.value)
    .map(([model, stats]) => ({
      model,
      calls: stats.calls,
      totalTokens: stats.totalTokens,
      totalCost: stats.totalCost,
      avgLatency: stats.avgLatency
    }))
    .sort((a, b) => b.calls - a.calls)
})

const windowOptions = [
  { label: 'Last 1h', value: 1 },
  { label: 'Last 6h', value: 6 },
  { label: 'Last 24h', value: 24 },
  { label: 'Last 72h', value: 72 },
  { label: 'Last 7d', value: 168 }
]

const { bar: barOptions, costBar: costBarOptions, doughnutRight: doughnutOptions } = useChartOptions()

const dailyLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: {
      type: 'linear' as const,
      position: 'left' as const,
      beginAtZero: true,
      ticks: { callback: (value: string | number) => `$${value}` }
    },
    y1: {
      type: 'linear' as const,
      position: 'right' as const,
      beginAtZero: true,
      grid: { drawOnChartArea: false },
      ticks: { callback: (value: string | number) => `${value}K` }
    }
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Summary Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <StatCard
        :value="totalCalls.toLocaleString()"
        label="API Calls"
        icon="i-lucide-message-square"
        icon-class="text-blue-500"
      />
      <StatCard
        :value="totalTokens.toLocaleString()"
        label="Total Tokens"
        icon="i-lucide-hash"
        icon-class="text-purple-500"
      />
      <StatCard
        :value="`$${totalCost.toFixed(4)}`"
        label="Total Cost"
        icon="i-lucide-dollar-sign"
        icon-class="text-green-500"
      />
      <StatCard
        :value="latencyStats?.p50 ? `${latencyStats.p50}ms` : '—'"
        label="p50 Latency"
        icon="i-lucide-gauge"
        icon-class="text-yellow-500"
      />
    </div>

    <!-- Time window -->
    <div class="flex items-center gap-3">
      <USelect
        v-model="hoursWindow"
        :items="windowOptions"
        class="w-36"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Model breakdown -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Calls by Model
          </h3>
        </template>
        <div
          v-if="modelCallsChart"
          class="h-64"
        >
          <Doughnut
            :data="modelCallsChart"
            :options="doughnutOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No model usage data yet.
        </p>
      </UCard>

      <!-- Provider cost -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Cost by Provider
          </h3>
        </template>
        <div
          v-if="providerCostChart"
          class="h-64"
        >
          <Bar
            :data="providerCostChart"
            :options="costBarOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No provider data yet.
        </p>
      </UCard>

      <!-- Latency by model -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Avg Latency by Model
          </h3>
        </template>
        <div
          v-if="latencyChart"
          class="h-64"
        >
          <Bar
            :data="latencyChart"
            :options="barOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No latency data yet.
        </p>
      </UCard>

      <!-- Latency percentiles -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Latency Percentiles
          </h3>
        </template>
        <div
          v-if="latencyStats"
          class="grid grid-cols-2 gap-4 py-4"
        >
          <div
            v-for="{ label, value } in [
              { label: 'Min', value: `${latencyStats.min}ms` },
              { label: 'p50', value: `${latencyStats.p50}ms` },
              { label: 'p90', value: `${latencyStats.p90}ms` },
              { label: 'p95', value: `${latencyStats.p95}ms` },
              { label: 'p99', value: `${latencyStats.p99}ms` },
              { label: 'Max', value: `${latencyStats.max}ms` },
              { label: 'Avg', value: `${latencyStats.avg}ms` },
              { label: 'Samples', value: latencyStats.count.toLocaleString() }
            ]"
            :key="label"
          >
            <p class="text-xs text-muted">
              {{ label }}
            </p>
            <p class="text-lg font-bold font-mono text-highlighted">
              {{ value }}
            </p>
          </div>
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No latency data yet.
        </p>
      </UCard>
    </div>

    <!-- Daily trends -->
    <UCard>
      <template #header>
        <h3 class="font-semibold text-highlighted">
          Daily Trends ({{ daysWindow }}d)
        </h3>
      </template>
      <div
        v-if="dailyTrendChart"
        class="h-72"
      >
        <Line
          :data="dailyTrendChart"
          :options="dailyLineOptions"
        />
      </div>
      <p
        v-else
        class="text-muted text-sm py-8 text-center"
      >
        No daily data yet.
      </p>
    </UCard>

    <!-- Model table -->
    <UCard>
      <template #header>
        <h3 class="font-semibold text-highlighted">
          Model Breakdown
        </h3>
      </template>
      <UTable
        v-if="modelTableData.length"
        :data="modelTableData"
        :columns="[
          { accessorKey: 'model', header: 'Model' },
          { accessorKey: 'calls', header: 'Calls' },
          { accessorKey: 'totalTokens', header: 'Tokens' },
          { accessorKey: 'totalCost', header: 'Cost' },
          { accessorKey: 'avgLatency', header: 'Avg Latency' }
        ]"
      >
        <template #model-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.model }}</span>
        </template>
        <template #calls-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.calls.toLocaleString() }}</span>
        </template>
        <template #totalTokens-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.totalTokens.toLocaleString() }}</span>
        </template>
        <template #totalCost-cell="{ row }">
          <span class="font-mono text-sm">${{ row.original.totalCost.toFixed(4) }}</span>
        </template>
        <template #avgLatency-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.avgLatency > 0 ? `${row.original.avgLatency}ms` : '—' }}</span>
        </template>
      </UTable>
      <p
        v-else
        class="text-muted text-sm py-4 text-center"
      >
        No model data yet.
      </p>
    </UCard>

    <!-- Provider detail -->
    <UCard v-if="providerStats && Object.keys(providerStats).length">
      <template #header>
        <h3 class="font-semibold text-highlighted">
          Provider Breakdown
        </h3>
      </template>
      <div class="space-y-4">
        <div
          v-for="[provider, stats] in Object.entries(providerStats).sort((a, b) => b[1].totalCost - a[1].totalCost)"
          :key="provider"
          class="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3 last:border-0"
        >
          <div>
            <p class="font-semibold text-highlighted">
              {{ provider }}
            </p>
            <p class="text-xs text-muted">
              Models: {{ stats.models.join(', ') }}
            </p>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <div class="text-right">
              <p class="font-mono text-highlighted">
                {{ stats.calls }} calls
              </p>
              <p class="font-mono text-xs text-muted">
                {{ stats.totalTokens.toLocaleString() }} tokens
              </p>
            </div>
            <UBadge
              :label="`$${stats.totalCost.toFixed(4)}`"
              variant="subtle"
              color="success"
            />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
