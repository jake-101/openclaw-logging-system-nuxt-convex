<script setup lang="ts">
definePageMeta({ title: 'Login', layout: false })

const { login, register, checkHasUsers } = useAuth()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const checkingUsers = ref(true)
const hasExistingUsers = ref(false)

const isSetup = computed(() => !hasExistingUsers.value)
const buttonLabel = computed(() => isSetup.value ? 'Create Account' : 'Sign In')
const heading = computed(() => isSetup.value ? 'Set Up Dashboard' : 'Sign In')
const description = computed(() =>
  isSetup.value
    ? 'Create your admin account to get started.'
    : 'Sign in to access the dashboard.'
)

// Check if any users exist on mount
onMounted(async () => {
  try {
    hasExistingUsers.value = await checkHasUsers()
  } catch {
    // Default to login mode if check fails
    hasExistingUsers.value = true
  } finally {
    checkingUsers.value = false
  }
})

async function handleSubmit() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Email and password are required'
    return
  }
  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    if (isSetup.value) {
      await register(email.value, password.value)
    } else {
      await login(email.value, password.value)
    }

    toast.add({
      title: isSetup.value ? 'Account created' : 'Signed in',
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
          <UIcon
            name="i-lucide-paw-print"
            class="h-7 w-7 text-white"
          />
        </div>
        <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">
          OpenClaw
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          Agent Logging Dashboard
        </p>
      </div>

      <UCard>
        <template #header>
          <div v-if="!checkingUsers">
            <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
              {{ heading }}
            </h2>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              {{ description }}
            </p>
          </div>
        </template>

        <!-- Loading state while checking if users exist -->
        <div
          v-if="checkingUsers"
          class="flex items-center justify-center py-8"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="h-6 w-6 animate-spin text-(--ui-text-muted)"
          />
        </div>

        <!-- Login / Setup form -->
        <form
          v-else
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
            :hint="isSetup ? 'Min 8 characters' : undefined"
          >
            <UInput
              v-model="password"
              type="password"
              placeholder="Enter password"
              icon="i-lucide-lock"
              :autocomplete="isSetup ? 'new-password' : 'current-password'"
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
            {{ buttonLabel }}
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
