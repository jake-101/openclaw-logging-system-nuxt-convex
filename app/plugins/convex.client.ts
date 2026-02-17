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
    // Create a single shared session ref — reused across all guard invocations
    const session = authClient.useSession()

    router.beforeEach(async (to) => {
      if (to.path === '/login') return true

      // If the session is still resolving, wait for isPending to clear rather
      // than using an arbitrary timeout that can lose the race.
      if (session.value?.isPending) {
        await new Promise<void>((resolve) => {
          const stop = watchEffect(() => {
            if (!session.value?.isPending) {
              stop()
              resolve()
            }
          })
          // Safety timeout: if still pending after 3s, give up and redirect
          setTimeout(() => {
            stop()
            resolve()
          }, 3000)
        })
      }

      if (!session.value?.data) {
        return { path: '/login' }
      }
      return true
    })
  })
})
