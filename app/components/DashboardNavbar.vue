<script setup lang="ts">
const route = useRoute()
const { getPageTitle, getPageIcon } = useNavigation()

const pageTitle = computed(() => getPageTitle(route.path))
const pageIcon = computed(() => getPageIcon(route.path))
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
