<script setup lang="ts">
const { sidebarGroups } = useNavigation()
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
        :items="sidebarGroups[0]"
        orientation="vertical"
      />

      <UNavigationMenu
        :collapsed="collapsed"
        :items="sidebarGroups[1]"
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
