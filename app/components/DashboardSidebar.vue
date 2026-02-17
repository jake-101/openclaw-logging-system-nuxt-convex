<script setup lang="ts">
const { sidebarGroups } = useNavigation()
const { logout, userEmail } = useAuth()
const toast = useToast()
const { appName, appLogoUrl } = useRuntimeConfig().public

async function handleLogout() {
  await logout()
  toast.add({
    title: 'Signed out',
    color: 'neutral'
  })
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardSidebar collapsible>
    <template #header="{ collapsed }">
      <div
        v-if="!collapsed"
        class="flex items-center gap-2"
      >
        <img
          v-if="appLogoUrl"
          :src="appLogoUrl"
          :alt="appName"
          class="size-6 rounded object-contain"
        >
        <UIcon
          v-else
          name="i-lucide-paw-print"
          class="size-6 text-primary"
        />
        <span class="font-bold text-highlighted">{{ appName }}</span>
      </div>
      <template v-else>
        <img
          v-if="appLogoUrl"
          :src="appLogoUrl"
          :alt="appName"
          class="size-6 rounded object-contain mx-auto"
        >
        <UIcon
          v-else
          name="i-lucide-paw-print"
          class="size-6 text-primary mx-auto"
        />
      </template>
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
        :class="collapsed ? 'flex-col justify-center' : 'justify-between'"
      >
        <UColorModeButton />
        <UTooltip
          :text="userEmail ?? 'Sign out'"
          :side="collapsed ? 'right' : 'top'"
        >
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="handleLogout"
          />
        </UTooltip>
      </div>
    </template>
  </UDashboardSidebar>
</template>
