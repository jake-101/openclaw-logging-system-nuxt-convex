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

  // Route guard: redirect to /login if not authenticated
  nuxtApp.hook('app:created', () => {
    const router = useRouter()
    router.beforeEach((to) => {
      if (to.path === '/login') return true
      const { isAuthenticated } = useAuth()
      if (!isAuthenticated.value) {
        return { path: '/login' }
      }
      return true
    })
  })
})
