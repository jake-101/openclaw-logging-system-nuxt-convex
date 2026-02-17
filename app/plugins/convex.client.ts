import { createConvexVue } from '@convex-vue/core'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const convexUrl = config.public.convexUrl as string

  if (!convexUrl) {
    console.error('CONVEX_URL is not set in runtime config')
    return
  }

  const { getToken, isAuthenticated, isLoading } = useAuth()

  const convexVue = createConvexVue({
    convexUrl,
    auth: {
      getToken,
      isAuthenticated,
      isLoading,
      installNavigationGuard: true,
      needsAuth: (to) => {
        // Login page does not require auth
        return to.path !== '/login'
      },
      redirectTo: () => {
        return { path: '/login' }
      }
    }
  })

  nuxtApp.vueApp.use(convexVue)
})
