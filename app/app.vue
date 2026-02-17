<script setup lang="ts">
const { appName, appLogoUrl } = useRuntimeConfig().public

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: appLogoUrl || '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = `${appName} Dashboard`
const description = `Agent logging and monitoring dashboard for ${appName} agents.`

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
