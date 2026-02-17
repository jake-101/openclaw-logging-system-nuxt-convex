import { createConvexVue } from '@convex-vue/core'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const convexUrl = config.public.convexUrl as string

  if (!convexUrl) {
    console.error('CONVEX_URL is not set in runtime config')
    return
  }

  const convexVue = createConvexVue({
    convexUrl
  })

  nuxtApp.vueApp.use(convexVue)
})
