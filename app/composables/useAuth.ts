/**
 * Auth composable wrapping Better Auth's Vue session.
 *
 * Provides a stable API surface for components:
 *   - isAuthenticated, isLoading, userEmail — reactive state
 *   - login(email, password) — sign in via Better Auth
 *   - logout() — sign out via Better Auth
 *
 * The authClient is provided by the convex.client plugin and
 * accesses Better Auth's HTTP endpoints on the Convex site deployment.
 */
export function useAuth() {
  const nuxtApp = useNuxtApp()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authClient = nuxtApp.$authClient as any

  const session = authClient.useSession()

  const isAuthenticated = computed(() => !!session.value?.data)
  const isLoading = computed(() => session.value?.isPending ?? true)
  const userEmail = computed(() => session.value?.data?.user?.email ?? null)

  async function login(email: string, password: string): Promise<void> {
    const result = await authClient.signIn.email({ email, password })
    if (result?.error) {
      throw new Error(result.error.message ?? 'Sign in failed')
    }
  }

  async function logout(): Promise<void> {
    await authClient.signOut()
  }

  return {
    isAuthenticated,
    isLoading,
    userEmail,
    login,
    logout
  }
}
