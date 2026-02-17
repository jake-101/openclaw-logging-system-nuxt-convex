<script setup lang="ts">
import { useConvexQuery } from '@convex-vue/core'
import { api } from '#convex/_generated/api'
import { Bar } from 'vue-chartjs'

definePageMeta({ title: 'Cron Jobs' })

const statusFilter = ref('all')
const { data: recentRuns, isLoading: isPending } = useConvexQuery(api.cronRuns.listRecent, computed(() => {
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

const { durationBar: barOptions } = useChartOptions()

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'OK', value: 'ok' },
  { label: 'Failed', value: 'failed' },
  { label: 'Timeout', value: 'timeout' }
]

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
      <StatCard
        :value="okRuns"
        label="Successful Runs"
        icon="i-lucide-check-circle"
        icon-class="text-green-500"
        :loading="isPending"
      />
      <StatCard
        :value="failedRuns"
        label="Failed Runs"
        icon="i-lucide-x-circle"
        :icon-class="failedRuns > 0 ? 'text-red-500' : 'text-muted'"
        :value-class="failedRuns > 0 ? 'text-red-500' : 'text-highlighted'"
        :loading="isPending"
      />
      <StatCard
        :value="totalRuns"
        label="Total Runs"
        icon="i-lucide-clock"
        icon-class="text-blue-500"
        :loading="isPending"
      />
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
        v-if="isPending"
        class="space-y-4"
      >
        <UCard
          v-for="n in 3"
          :key="n"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <USkeleton class="size-5 rounded" />
                <div class="space-y-1">
                  <USkeleton class="h-4 w-32" />
                  <USkeleton class="h-3 w-48" />
                </div>
              </div>
              <USkeleton class="h-5 w-16 rounded-full" />
            </div>
          </template>
        </UCard>
      </div>

      <EmptyState
        v-else-if="!jobs.length && recentRuns"
        icon="i-lucide-timer"
        title="No cron jobs recorded yet."
        description="Jobs will appear here once OpenClaw starts reporting."
      />

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
                :color="STATUS_COLORS[run.status] || 'neutral'"
                variant="subtle"
                size="xs"
                class="w-16 justify-center"
              />
              <span class="text-xs text-muted shrink-0">
                {{ formatFullTimestamp(run.completedAt) }}
              </span>
              <span class="text-xs font-mono text-muted shrink-0">
                {{ formatDurationMs(run.durationMs) }}
              </span>
              <span
                v-if="run.summary"
                class="text-sm text-highlighted flex-1 min-w-0"
              >
                {{ run.summary }}
              </span>
              <span
                v-if="run.error"
                class="text-sm text-red-500 flex-1 min-w-0"
              >
                {{ run.error }}
              </span>
              <span
                v-if="run.sessionKey"
                class="text-xs font-mono text-muted truncate shrink min-w-0 max-w-[30%]"
                :title="run.sessionKey"
              >
                {{ run.sessionKey }}
              </span>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
