import type { Ref } from 'vue'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'

// Function references for auth endpoints (avoids dependency on generated types)
const authLogin = makeFunctionReference<'mutation'>('auth:login')
const authRegister = makeFunctionReference<'mutation'>('auth:register')
const authLogout = makeFunctionReference<'mutation'>('auth:logout')
const authValidateSession = makeFunctionReference<'query'>('auth:validateSession')
const authHasUsers = makeFunctionReference<'query'>('auth:hasUsers')

const TOKEN_KEY = 'openclaw-auth-token'

// Shared reactive state (singleton across the app)
const token = ref<string | null>(null)
const isAuthenticated = ref(false)
const isLoading = ref(true)
const userEmail = ref<string | null>(null)

let initialized = false

function getHttpClient(): ConvexHttpClient {
  const config = useRuntimeConfig()
  return new ConvexHttpClient(config.public.convexUrl as string)
}

/**
 * Composable for dashboard authentication.
 *
 * Manages session tokens in localStorage and provides reactive auth state
 * compatible with @convex-vue/core's auth adapter interface.
 */
export function useAuth() {
  // Initialize from localStorage on first call (client-side only)
  if (!initialized && import.meta.client) {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      token.value = stored
      isAuthenticated.value = true
      // Validate the stored token asynchronously
      validateStoredToken(stored)
    }
    isLoading.value = false
    initialized = true
  }

  async function validateStoredToken(storedToken: string) {
    try {
      const client = getHttpClient()
      const result = await client.query(authValidateSession, { token: storedToken })
      if (!result) {
        clearSession()
      } else {
        userEmail.value = (result as { email: string }).email
      }
    } catch {
      // If validation fails (e.g. server unreachable), keep the token
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const client = getHttpClient()
    const result = await client.mutation(authLogin, { email, password }) as { token: string, email: string }
    setSession(result.token, result.email)
  }

  async function register(email: string, password: string): Promise<void> {
    const client = getHttpClient()
    const result = await client.mutation(authRegister, { email, password }) as { token: string }
    setSession(result.token)
  }

  async function logout(): Promise<void> {
    if (token.value) {
      try {
        const client = getHttpClient()
        await client.mutation(authLogout, { token: token.value })
      } catch {
        // Ignore server errors during logout
      }
    }
    clearSession()
  }

  async function checkHasUsers(): Promise<boolean> {
    const client = getHttpClient()
    return await client.query(authHasUsers, {}) as boolean
  }

  function setSession(newToken: string, email?: string) {
    token.value = newToken
    isAuthenticated.value = true
    userEmail.value = email ?? null
    if (import.meta.client) {
      localStorage.setItem(TOKEN_KEY, newToken)
    }
  }

  function clearSession() {
    token.value = null
    isAuthenticated.value = false
    userEmail.value = null
    if (import.meta.client) {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  async function getToken(_opts: { forceRefreshToken: boolean }): Promise<string | null> {
    return token.value
  }

  return {
    // State
    token: token as Ref<string | null>,
    isAuthenticated: isAuthenticated as Ref<boolean>,
    isLoading: isLoading as Ref<boolean>,
    userEmail: userEmail as Ref<string | null>,

    // Auth actions
    login,
    register,
    logout,
    checkHasUsers,

    // Session management
    setSession,
    clearSession,
    getToken
  }
}
