# ---- Build stage ----
FROM node:22-alpine AS builder

# Enable corepack so pnpm is available
RUN corepack enable

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (including devDeps needed for the build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the Nuxt app
# runtimeConfig.public values are overridden at runtime via NUXT_PUBLIC_* env vars,
# so we don't need real values here — placeholders keep the build self-contained.
RUN pnpm build

# ---- Runtime stage ----
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only the built output — no node_modules, no source
COPY --from=builder /app/.output /app/.output

# Nitro listens on this port by default
ENV PORT=3000
EXPOSE 3000

# Runtime env vars (all overridable via Docker / Unraid template):
#
#   NUXT_PUBLIC_CONVEX_URL      - Convex deployment URL          (required)
#   NUXT_PUBLIC_CONVEX_SITE_URL - Convex site URL for Better Auth (required)
#   NUXT_PUBLIC_APP_NAME        - Dashboard name                  (default: OpenClaw)
#   NUXT_PUBLIC_APP_LOGO_URL    - URL to logo image               (optional)

CMD ["node", "/app/.output/server/index.mjs"]
