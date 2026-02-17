<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const statusFilter = ref('all')
const { data: recentRuns } = useConvexQuery(api.cronRuns.listRecent, computed(() => {
  if (statusFilter.value !== 'all') {
    return { limit: 100, status: statusFilter.value }
  }
  return { limit: 100 }
}))

// Group runs by jobId to build job overview
const jobs = computed(() => {
  if (!recentRuns.value?.length) return []
  const jobMap = new Map<string, {
    jobId: string
    jobName: string
    runs: typeof recentRuns.value
    lastRun: (typeof recentRuns.value)[0]
    okCount: number
    failedCount: number
  }>()

  for (const run of recentRuns.value) {
    const existing = jobMap.get(run.jobId)
    if (existing) {
      existing.runs.push(run)
      if (run.status === 'ok') existing.okCount++
      else if (run.status === 'failed') existing.failedCount++
    } else {
      jobMap.set(run.jobId, {
        jobId: run.jobId,
        jobName: run.jobName ?? run.jobId,
        runs: [run],
        lastRun: run,
        okCount: run.status === 'ok' ? 1 : 0,
        failedCount: run.status === 'failed' ? 1 : 0
      })
    }
  }

  return Array.from(jobMap.values())
    .sort((a, b) => b.lastRun.completedAt - a.lastRun.completedAt)
})

// Summary stats
const totalRuns = computed(() => recentRuns.value?.length ?? 0)
const failedRuns = computed(() => recentRuns.value?.filter(r => r.status === 'failed').length ?? 0)
const okRuns = computed(() => recentRuns.value?.filter(r => r.status === 'ok').length ?? 0)

// Duration chart for all recent runs
const durationChartData = computed(() => {
  if (!recentRuns.value?.length) return null
  const sorted = [...recentRuns.value].reverse().slice(-30)
  return {
    labels: sorted.map(r => new Date(r.completedAt).toLocaleTimeString()),
    datasets: [{
      label: 'Duration (ms)',
      data: sorted.map(r => r.durationMs),
      backgroundColor: sorted.map(r =>
        r.status === 'ok'
          ? 'rgba(34, 197, 94, 0.7)'
          : r.status === 'failed'
            ? 'rgba(239, 68, 68, 0.7)'
            : 'rgba(234, 179, 8, 0.7)'
      ),
      borderRadius: 4
    }]
  }
})

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { callback: (value: string | number) => `${value}ms` }
    }
  }
}

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'OK', value: 'ok' },
  { label: 'Failed', value: 'failed' },
  { label: 'Timeout', value: 'timeout' }
]

const statusColors: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  ok: 'success',
  failed: 'error',
  timeout: 'warning'
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// Expanded job detail
const expandedJobId = ref<string | null>(null)
function toggleJob(jobId: string) {
  expandedJobId.value = expandedJobId.value === jobId ? null : jobId
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Summary Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard>
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-check-circle"
            class="size-8 text-green-500"
          />
          <div>
            <p class="text-2xl font-bold text-highlighted">
              {{ okRuns }}
            </p>
            <p class="text-sm text-muted">
              Successful Runs
            </p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-x-circle"
            :class="['size-8', failedRuns > 0 ? 'text-red-500' : 'text-muted']"
          />
          <div>
            <p
              class="text-2xl font-bold"
              :class="failedRuns > 0 ? 'text-red-500' : 'text-highlighted'"
            >
              {{ failedRuns }}
            </p>
            <p class="text-sm text-muted">
              Failed Runs
            </p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-clock"
            class="size-8 text-blue-500"
          />
          <div>
            <p class="text-2xl font-bold text-highlighted">
              {{ totalRuns }}
            </p>
            <p class="text-sm text-muted">
              Total Runs
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Duration Chart -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-highlighted">
            Run Duration Trend
          </h3>
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            class="w-36"
          />
        </div>
      </template>
      <div
        v-if="durationChartData"
        class="h-64"
      >
        <Bar
          :data="durationChartData"
          :options="barOptions"
        />
      </div>
      <p
        v-else
        class="text-muted text-sm py-8 text-center"
      >
        No cron run data yet.
      </p>
    </UCard>

    <!-- Jobs List -->
    <div class="space-y-4">
      <h3 class="font-semibold text-highlighted text-lg">
        Jobs
      </h3>

      <div
        v-if="!jobs.length && recentRuns"
        class="flex flex-col items-center justify-center py-16"
      >
        <UIcon
          name="i-lucide-timer"
          class="size-12 text-muted mb-3"
        />
        <p class="text-muted">
          No cron jobs recorded yet.
        </p>
        <p class="text-sm text-muted">
          Jobs will appear here once OpenClaw starts reporting.
        </p>
      </div>

      <UCard
        v-for="job in jobs"
        :key="job.jobId"
      >
        <template #header>
          <button
            class="w-full flex items-center justify-between cursor-pointer"
            @click="toggleJob(job.jobId)"
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="job.failedCount > 0 ? 'i-lucide-alert-triangle' : 'i-lucide-check-circle'"
                :class="['size-5', job.failedCount > 0 ? 'text-red-500' : 'text-green-500']"
              />
              <div class="text-left">
                <h4 class="font-semibold text-highlighted">
                  {{ job.jobName }}
                </h4>
                <p class="text-xs text-muted font-mono">
                  {{ job.jobId }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <UBadge
                :label="`${job.okCount} ok`"
                color="success"
                variant="subtle"
                size="xs"
              />
              <UBadge
                v-if="job.failedCount > 0"
                :label="`${job.failedCount} failed`"
                color="error"
                variant="subtle"
                size="xs"
              />
              <span class="text-xs text-muted">
                {{ formatRelativeTime(job.lastRun.completedAt) }}
              </span>
              <UIcon
                :name="expandedJobId === job.jobId ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4 text-muted"
              />
            </div>
          </button>
        </template>

        <div v-if="expandedJobId === job.jobId">
          <div class="space-y-2">
            <div
              v-for="run in job.runs.slice(0, 20)"
              :key="run.runId"
              class="flex items-center gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
            >
              <UBadge
                :label="run.status"
                :color="statusColors[run.status] || 'neutral'"
                variant="subtle"
                size="xs"
                class="w-16 justify-center"
              />
              <span class="text-xs text-muted shrink-0">
                {{ formatTimestamp(run.completedAt) }}
              </span>
              <span class="text-xs font-mono text-muted shrink-0">
                {{ formatDuration(run.durationMs) }}
              </span>
              <span
                v-if="run.summary"
                class="text-sm text-highlighted truncate flex-1"
              >
                {{ run.summary }}
              </span>
              <span
                v-if="run.error"
                class="text-sm text-red-500 truncate flex-1"
              >
                {{ run.error }}
              </span>
              <NuxtLink
                v-if="run.sessionKey"
                :to="`/session-${run.sessionKey}`"
                class="text-xs font-mono text-primary hover:underline shrink-0"
              >
                {{ run.sessionKey }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
