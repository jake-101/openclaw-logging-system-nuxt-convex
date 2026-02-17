<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const navigation: NavigationMenuItem[][] = [[
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/'
  },
  {
    label: 'Logs',
    icon: 'i-lucide-scroll-text',
    to: '/logs'
  },
  {
    label: 'Sessions',
    icon: 'i-lucide-activity',
    to: '/sessions'
  },
  {
    label: 'Errors',
    icon: 'i-lucide-alert-triangle',
    to: '/errors'
  }
], [
  {
    label: 'Analytics',
    icon: 'i-lucide-bar-chart-3',
    to: '/analytics'
  }
]]
</script>

<template>
  <UDashboardSidebar collapsible>
    <template #header="{ collapsed }">
      <div
        v-if="!collapsed"
        class="flex items-center gap-2"
      >
        <UIcon
          name="i-lucide-paw-print"
          class="size-6 text-primary"
        />
        <span class="font-bold text-highlighted">OpenClaw</span>
      </div>
      <UIcon
        v-else
        name="i-lucide-paw-print"
        class="size-6 text-primary mx-auto"
      />
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        :collapsed="collapsed"
        :items="navigation[0]"
        orientation="vertical"
      />

      <UNavigationMenu
        :collapsed="collapsed"
        :items="navigation[1]"
        orientation="vertical"
        class="mt-auto"
      />
    </template>

    <template #footer="{ collapsed }">
      <div
        class="flex items-center gap-2"
        :class="collapsed ? 'justify-center' : ''"
      >
        <UColorModeButton />
      </div>
    </template>
  </UDashboardSidebar>
</template>
