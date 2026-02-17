<script setup lang="ts">
const route = useRoute()

const pageTitle = computed(() => {
  const path = route.path
  if (path === '/') return 'Dashboard'
  if (path === '/logs') return 'Logs'
  if (path === '/sessions') return 'Sessions'
  if (path === '/errors') return 'Errors'
  if (path === '/analytics') return 'Analytics'
  if (path === '/crons') return 'Cron Jobs'
  if (path === '/rate-limits') return 'Rate Limits'
  if (path === '/models') return 'Model Usage'
  if (path.startsWith('/session-')) return 'Session Detail'
  return 'OpenClaw'
})

const pageIcon = computed(() => {
  const path = route.path
  if (path === '/') return 'i-lucide-layout-dashboard'
  if (path === '/logs') return 'i-lucide-scroll-text'
  if (path === '/sessions') return 'i-lucide-activity'
  if (path === '/errors') return 'i-lucide-alert-triangle'
  if (path === '/analytics') return 'i-lucide-bar-chart-3'
  if (path === '/crons') return 'i-lucide-timer'
  if (path === '/rate-limits') return 'i-lucide-shield-alert'
  if (path === '/models') return 'i-lucide-cpu'
  if (path.startsWith('/session-')) return 'i-lucide-activity'
  return undefined
})
</script>

<template>
  <UDashboardNavbar
    :title="pageTitle"
    :icon="pageIcon"
  >
    <template #leading>
      <UDashboardSidebarCollapse />
    </template>
  </UDashboardNavbar>
</template>
