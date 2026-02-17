<template>
  <UDashboardGroup>
    <DashboardSidebar />

    <UDashboardPanel>
      <template #header>
        <DashboardNavbar />
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
