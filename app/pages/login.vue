<script setup lang="ts">
definePageMeta({ title: 'Login', layout: false })

const { login } = useAuth()
const { appName, appLogoUrl } = useRuntimeConfig().public
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Email and password are required'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await login(email.value, password.value)
    toast.add({
      title: 'Signed in',
      description: `Welcome, ${email.value}`,
      color: 'success'
    })
    await navigateTo('/')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed'
    errorMessage.value = message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--ui-bg)">
    <div class="w-full max-w-sm space-y-6 px-4">
      <!-- Logo / Branding -->
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-(--ui-primary)">
          <img
            v-if="appLogoUrl"
            :src="appLogoUrl"
            :alt="appName"
            class="h-8 w-8 rounded object-contain"
          >
          <UIcon
            v-else
            name="i-lucide-paw-print"
            class="h-7 w-7 text-white"
          />
        </div>
        <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">
          {{ appName }}
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          Agent Logging Dashboard
        </p>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
            Sign In
          </h2>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            Sign in to access the dashboard.
          </p>
        </template>

        <form
          class="space-y-4"
          @submit.prevent="handleSubmit"
        >
          <UFormField
            name="email"
            label="Email"
            required
          >
            <UInput
              v-model="email"
              type="email"
              placeholder="admin@example.com"
              icon="i-lucide-mail"
              autocomplete="email"
              :disabled="loading"
            />
          </UFormField>

          <UFormField
            name="password"
            label="Password"
            required
          >
            <UInput
              v-model="password"
              type="password"
              placeholder="Enter password"
              icon="i-lucide-lock"
              autocomplete="current-password"
              :disabled="loading"
            />
          </UFormField>

          <!-- Error message -->
          <div
            v-if="errorMessage"
            class="flex items-center gap-2 rounded-md bg-(--ui-error)/10 px-3 py-2 text-sm text-(--ui-error)"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="h-4 w-4 shrink-0"
            />
            {{ errorMessage }}
          </div>

          <UButton
            type="submit"
            block
            :loading="loading"
            :disabled="loading"
            icon="i-lucide-log-in"
          >
            Sign In
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
