import { createConvexVue } from '@convex-vue/core'
import { createAuthClient } from 'better-auth/vue'
import { crossDomainClient } from '@convex-dev/better-auth/client/plugins'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const convexUrl = config.public.convexUrl as string
  const convexSiteUrl = config.public.convexSiteUrl as string

  if (!convexUrl) {
    console.error('CONVEX_URL is not set in runtime config')
    return
  }

  // Better Auth client — connects to HTTP routes on the Convex site deployment
  const authClient = createAuthClient({
    baseURL: convexSiteUrl,
    plugins: [crossDomainClient()]
  })

  // Provide authClient for use in composables
  nuxtApp.provide('authClient', authClient)

  // Convex Vue — no auth adapter, our Convex functions don't use ctx.auth.
  // Auth is handled entirely by Better Auth at the HTTP layer.
  const convexVue = createConvexVue({ convexUrl })
  nuxtApp.vueApp.use(convexVue)

  // Route guard: use Better Auth session to protect all routes except /login
  nuxtApp.hook('app:created', () => {
    const router = useRouter()
    router.beforeEach(async (to) => {
      if (to.path === '/login') return true
      const session = authClient.useSession()
      // isPending is true on first tick — wait briefly for cookie session to resolve
      if (session.value?.isPending) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      if (!session.value?.data) {
        return { path: '/login' }
      }
      return true
    })
  })
})
