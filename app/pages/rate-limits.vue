<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import { Bar, Doughnut } from 'vue-chartjs'

definePageMeta({ title: 'Rate Limits' })

const hoursWindow = ref(6)
const { data: recentEvents, isLoading: eventsPending } = useConvexQuery(api.rateLimits.listRecent, computed(() => ({
  limit: 200,
  hours: hoursWindow.value
})))
const { data: stats, isLoading: statsPending } = useConvexQuery(api.rateLimits.getStats, computed(() => ({
  hours: hoursWindow.value
})))

const isPending = computed(() => eventsPending.value || statsPending.value)

// Provider breakdown chart
const providerChartData = computed(() => {
  if (!stats.value?.byProvider || Object.keys(stats.value.byProvider).length === 0) return null
  const entries = Object.entries(stats.value.byProvider).sort((a, b) => b[1] - a[1])
  const colors = [
    'rgba(239, 68, 68, 0.7)',
    'rgba(234, 179, 8, 0.7)',
    'rgba(59, 130, 246, 0.7)',
    'rgba(139, 92, 246, 0.7)',
    'rgba(34, 197, 94, 0.7)',
    'rgba(236, 72, 153, 0.7)'
  ]
  return {
    labels: entries.map(([provider]) => provider),
    datasets: [{
      data: entries.map(([, count]) => count),
      backgroundColor: entries.map((_, i) => colors[i % colors.length])
    }]
  }
})

// Hourly frequency chart (group events into hourly buckets)
const hourlyChartData = computed(() => {
  if (!recentEvents.value?.length) return null
  const now = Date.now()
  const buckets = new Map<string, number>()

  // Create empty hour buckets
  for (let h = hoursWindow.value - 1; h >= 0; h--) {
    const time = new Date(now - h * 60 * 60 * 1000)
    const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    buckets.set(label, 0)
  }

  // Fill buckets
  for (const event of recentEvents.value) {
    const time = new Date(event.timestamp)
    const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (buckets.has(label)) {
      buckets.set(label, (buckets.get(label) ?? 0) + 1)
    }
  }

  const entries = Array.from(buckets.entries())
  return {
    labels: entries.map(([label]) => label),
    datasets: [{
      label: 'Rate Limit Events',
      data: entries.map(([, count]) => count),
      backgroundColor: entries.map(([, count]) =>
        count >= 5
          ? 'rgba(239, 68, 68, 0.7)'
          : count >= 2
            ? 'rgba(234, 179, 8, 0.7)'
            : 'rgba(148, 163, 184, 0.5)'
      ),
      borderRadius: 4
    }]
  }
})

const { bar: barOptions, doughnut: doughnutOptions } = useChartOptions()

const windowOptions = [
  { label: 'Last 1h', value: 1 },
  { label: 'Last 3h', value: 3 },
  { label: 'Last 6h', value: 6 }
]

// Alert threshold
const alertThreshold = 10
const isHighRate = computed(() => (stats.value?.hourlyRate ?? 0) >= alertThreshold)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Alert banner -->
    <UAlert
      v-if="isHighRate"
      title="High rate limit frequency detected"
      :description="`${stats?.hourlyRate.toFixed(1)} events/hour over the last ${hoursWindow}h exceeds the threshold of ${alertThreshold}/hour.`"
      color="error"
      icon="i-lucide-alert-triangle"
    />

    <!-- Summary Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        :value="stats?.total ?? 0"
        :label="`Events (${hoursWindow}h)`"
        icon="i-lucide-shield-alert"
        :icon-class="(stats?.total ?? 0) > 0 ? 'text-red-500' : 'text-muted'"
        :value-class="(stats?.total ?? 0) > 0 ? 'text-red-500' : 'text-highlighted'"
        :loading="isPending"
      />
      <StatCard
        :value="stats?.hourlyRate?.toFixed(1) ?? '0'"
        label="Events/Hour"
        icon="i-lucide-trending-up"
        icon-class="text-yellow-500"
        :loading="isPending"
      />
      <StatCard
        :value="Object.keys(stats?.byProvider ?? {}).length"
        label="Providers Affected"
        icon="i-lucide-server"
        icon-class="text-blue-500"
        :loading="isPending"
      />
    </div>

    <!-- Time window selector -->
    <div class="flex items-center gap-3">
      <USelect
        v-model="hoursWindow"
        :items="windowOptions"
        class="w-36"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Hourly frequency -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            Hourly Frequency
          </h3>
        </template>
        <div
          v-if="hourlyChartData"
          class="h-64"
        >
          <Bar
            :data="hourlyChartData"
            :options="barOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No rate limit events in this window.
        </p>
      </UCard>

      <!-- By provider -->
      <UCard>
        <template #header>
          <h3 class="font-semibold text-highlighted">
            By Provider
          </h3>
        </template>
        <div
          v-if="providerChartData"
          class="h-64"
        >
          <Doughnut
            :data="providerChartData"
            :options="doughnutOptions"
          />
        </div>
        <p
          v-else
          class="text-muted text-sm py-8 text-center"
        >
          No provider data yet.
        </p>
      </UCard>
    </div>

    <!-- Event Timeline -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-highlighted">
            Recent Events
          </h3>
          <UBadge
            v-if="recentEvents"
            :label="`${recentEvents.length} events`"
            variant="subtle"
            color="neutral"
          />
        </div>
      </template>

      <div
        v-if="recentEvents?.length"
        class="space-y-2"
      >
        <div
          v-for="event in recentEvents"
          :key="event._id"
          class="flex items-center gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
        >
          <UIcon
            name="i-lucide-shield-alert"
            class="size-4 text-red-500 shrink-0"
          />
          <UBadge
            :label="event.provider"
            variant="subtle"
            color="neutral"
            size="xs"
          />
          <span
            v-if="event.endpoint"
            class="text-xs font-mono text-muted truncate"
          >
            {{ event.endpoint }}
          </span>
          <span
            v-if="event.retryAfter"
            class="text-xs text-yellow-600 dark:text-yellow-400 shrink-0"
          >
            retry {{ event.retryAfter }}s
          </span>
          <span class="ml-auto text-xs text-muted shrink-0">
            {{ formatRelativeTime(event.timestamp) }}
          </span>
          <NuxtLink
            :to="`/session-${event.sessionKey}`"
            class="text-xs font-mono text-primary hover:underline shrink-0"
          >
            {{ event.sessionKey }}
          </NuxtLink>
        </div>
      </div>

      <EmptyState
        v-else-if="recentEvents"
        icon="i-lucide-check-circle"
        icon-class="text-green-500"
        title="No rate limit events"
        :description="`No rate limits hit in the last ${hoursWindow} hours.`"
      />
    </UCard>
  </div>
</template>
