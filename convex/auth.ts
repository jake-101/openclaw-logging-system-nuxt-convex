import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal'
import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { query } from './_generated/server'

const siteUrl = process.env.SITE_URL!

// The component client — use this for registerRoutes, getAuthUser, adapter, etc.
export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: true
    },
    plugins: [
      // Required for SPA (cross-origin cookie handling between .convex.site and app)
      crossDomain({ siteUrl })
    ]
  } satisfies BetterAuthOptions)
}

/**
 * Query to get the currently authenticated user from the Better Auth component.
 * Returns null if not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx)
  }
})
