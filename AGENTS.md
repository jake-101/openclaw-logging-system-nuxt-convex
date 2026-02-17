# AGENTS.md - OpenClaw Logging System

Agent logging and monitoring dashboard for OpenClaw agents (BadgerBot).
Nuxt 4 frontend with Convex real-time backend.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 Composition API, `<script setup>`)
- **Backend**: Convex (real-time database, TypeScript functions)
- **UI**: @nuxt/ui v4 (Reka UI + Tailwind CSS v4 + Tailwind Variants)
- **Icons**: @iconify-json/lucide, @iconify-json/simple-icons
- **Testing**: Vitest + @vue/test-utils + happy-dom
- **Package Manager**: pnpm (v10+, declared in `packageManager` field)

## Build / Dev / Test Commands

```bash
pnpm dev              # Start Nuxt dev server (HMR)
pnpm build            # Production build
pnpm preview          # Preview production build locally
pnpm lint             # ESLint check (no fix)
pnpm lint:fix         # ESLint with auto-fix
pnpm typecheck        # vue-tsc type checking via `nuxt typecheck`
pnpm test             # Run all tests once (vitest run)
pnpm test:watch       # Run tests in watch mode
```

### Running a Single Test

```bash
pnpm vitest run path/to/file.test.ts          # Single file
pnpm vitest run -t "test name pattern"         # By test name
pnpm vitest run path/to/file.test.ts -t "name" # File + name
```

### Convex

```bash
pnpm convex:dev       # Start Convex dev server (watches convex/ dir)
pnpm convex:deploy    # Deploy Convex functions to production
npx convex dev        # Alternative: direct npx invocation
```

Convex functions live in `convex/`. After changing `convex/schema.ts`, run
`npx convex dev` to regenerate `convex/_generated/`.

## Project Structure

```
app/                    # Nuxt 4 app directory (all frontend code)
  app.vue               # Root layout (UApp wrapper)
  app.config.ts         # App-level config (UI theme colors)
  assets/css/main.css   # Tailwind + Nuxt UI imports, theme overrides
  components/           # Auto-imported Vue components
  pages/                # File-based routing
convex/                 # Convex backend (schema + server functions)
  schema.ts             # Database schema (logs, sessions, errors)
  logs.ts               # Log CRUD queries/mutations
  sessions.ts           # Session queries/mutations
  errors.ts             # Error tracking queries/mutations
  _generated/           # Auto-generated (do NOT edit)
nuxt.config.ts          # Nuxt configuration
vitest.config.ts        # Vitest configuration
eslint.config.mjs       # ESLint flat config (extends @nuxt/eslint)
```

## Code Style

### ESLint (enforced via @nuxt/eslint with stylistic rules)

- **No trailing comma**: `commaDangle: 'never'` -- do NOT add trailing commas
- **Brace style**: `1tbs` (one true brace style) -- opening brace on same line
- **Single quotes** for strings (ESLint stylistic default)
- **No semicolons** (ESLint stylistic default)
- **2-space indentation** (set in .editorconfig)
- **LF line endings** (set in .editorconfig)
- Run `pnpm lint:fix` to auto-fix before committing

### TypeScript

- Strict mode via Nuxt's generated tsconfig
- Use `defineNuxtConfig`, `defineAppConfig`, `definePageMeta` -- auto-imported
- Prefer explicit types for function parameters and return values
- Use `v.` validators from `convex/values` for all Convex function args
- Never use `any` unless wrapping untyped metadata blobs (use `v.any()` sparingly)

### Vue Components

- Always use `<script setup lang="ts">` (Composition API only, no Options API)
- Components in `app/components/` are auto-imported (no manual imports needed)
- Composables in `app/composables/` are auto-imported
- Use Nuxt UI components (`UButton`, `UCard`, `UTable`, etc.) -- not raw HTML
- Use `NuxtLink` instead of `<a>`, `NuxtImg` instead of `<img>`
- Wrap root layout in `<UApp>` for toast/tooltip context

### Naming Conventions

- **Components**: PascalCase filenames (`LogViewer.vue`, `SessionList.vue`)
- **Composables**: camelCase with `use` prefix (`useLogStream.ts`)
- **Pages**: kebab-case filenames (`session-[key].vue`)
- **Convex functions**: camelCase exports (`logs.create`, `sessions.upsert`)
- **Types/Interfaces**: PascalCase, no `I` prefix (`LogEntry`, `SessionStats`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants

### Imports

- Nuxt auto-imports: `ref`, `computed`, `watch`, `useFetch`, `useRoute`,
  `navigateTo`, `definePageMeta`, `useHead`, `useSeoMeta` -- do NOT import these
- Convex imports: `import { api } from '~/convex/_generated/api'`
- Convex server: `import { query, mutation } from './_generated/server'`
- Convex values: `import { v } from 'convex/values'`

### Error Handling

- Convex mutations/queries throw on validation failure -- wrap calls in try/catch
  at the component level and surface errors via `useToast()`
- Use the `errors` table for persistent error tracking from agents
- Log errors with `level: 'error'` to the `logs` table for dashboard visibility
- Never swallow errors silently -- always log or surface to the user

## Convex Schema Overview

Three tables: `logs`, `sessions`, `errors`.

- **logs**: Individual log entries with session/agent context and optional tool
  tracking. Indexed by session+timestamp, timestamp, level, and toolName.
- **sessions**: Aggregated session summaries with stats (messageCount, toolCalls,
  errors, tokenUsage, cost). Upserted on each activity.
- **errors**: Dedicated error tracking with resolution state. Query `unresolved`
  for the error dashboard.

All timestamps are Unix milliseconds (`Date.now()`). Session keys are
string identifiers linking logs to sessions.

## Testing Conventions

- Test files: colocate as `*.test.ts` or `*.spec.ts` next to source
- Use `describe`/`it` blocks with clear descriptions
- Test Convex functions independently (unit test handler logic)
- Test Vue components with `@vue/test-utils` mount/shallowMount
- Environment: happy-dom (configured in `vitest.config.ts`)

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push:
1. `pnpm install`
2. `pnpm lint`
3. `pnpm typecheck`

Tests are not yet in CI -- add `pnpm test` step when test suite exists.

## Environment Variables

- `CONVEX_URL`: Convex deployment URL (required for runtime)
- See `.env.example` for template
- Never commit `.env` files (listed in `.gitignore`)

## Skills / Agent Instructions

When working in this codebase, load the **nuxt** skill and follow Nuxt 4 best
practices. Key points:

- This is **Nuxt 4** -- use Nuxt 4 patterns, not Nuxt 2/3 legacy patterns.
  Use `<NuxtPage />` (not `<Nuxt />`), typed router with route names,
  `useRequestURL()` (not `window.origin`), and `getRouterParam()` for server
  route params.
- Load the nuxt skill sub-references on demand based on the task:
  - `server.md` -- API routes, server middleware, validation
  - `routing.md` -- file-based routing, route groups, typed router
  - `middleware-plugins.md` -- route middleware, plugins, lifecycle
  - `nuxt-composables.md` -- useFetch, useRequestURL, navigation helpers
  - `nuxt-components.md` -- NuxtLink, NuxtImg, NuxtTime
  - `nuxt-config.md` -- nuxt.config.ts, modules, auto-imports
- Load the **vue** skill when writing `.vue` components or composables.
- Load the **nuxt-ui** skill when using @nuxt/ui components (Button, Modal,
  Form, Table, Toast, etc.) or customizing the theme.
- Load the **vitest** skill when writing or debugging tests.
- A Convex skill does not exist yet. Refer to the Convex schema and function
  files in `convex/` as the source of truth for backend patterns.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
