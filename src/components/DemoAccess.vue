<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { backendEnabled } from '@/services/commands';

type AccessState = 'loading' | 'ready' | 'error';

const state = ref<AccessState>('loading');
const authenticated = ref(false);
const passcode = ref('');
const message = ref('');
const submitting = ref(false);

async function checkAccess() {
  state.value = 'loading';
  message.value = '';

  // Frontend-only local development has no backend to ask; there is nothing to protect.
  if (import.meta.env.DEV && !backendEnabled) {
    authenticated.value = true;
    state.value = 'ready';
    return;
  }

  try {
    const response = await fetch('/api/access', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (response.status === 404 && import.meta.env.DEV && !backendEnabled) {
      authenticated.value = true;
      state.value = 'ready';
      return;
    }

    if (!response.ok) {
      throw new Error('Unable to check demo access. Please try again.');
    }

    const result = await response.json() as { authenticated?: boolean; required?: boolean };
    authenticated.value = result.authenticated === true;
    state.value = 'ready';
  } catch (error) {
    authenticated.value = false;
    state.value = 'error';
    message.value = error instanceof Error ? error.message : 'Unable to connect. Please try again.';
  }
}

async function submitPasscode() {
  if (submitting.value || !passcode.value) return;

  submitting.value = true;
  message.value = '';

  try {
    const response = await fetch('/api/access', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: passcode.value }),
    });

    if (response.ok) {
      authenticated.value = true;
      state.value = 'ready';
      return;
    }

    let serverMessage = '';
    try {
      const result = await response.json() as { error?: string };
      serverMessage = typeof result.error === 'string' ? result.error : '';
    } catch {
      // Keep a local message when the server response has no readable JSON.
    }

    if (response.status === 401) {
      message.value = serverMessage || 'That passcode is not correct. Try again.';
    } else if (response.status === 429) {
      message.value = serverMessage || 'Too many attempts. Please wait a moment and try again.';
    } else {
      message.value = serverMessage || 'Unable to verify passcode. Please try again.';
    }
  } catch {
    message.value = 'Unable to connect. Check your connection and try again.';
  } finally {
    passcode.value = '';
    submitting.value = false;
  }
}

function handleAccessRequired() {
  authenticated.value = false;
  passcode.value = '';
  message.value = 'Your demo session has expired. Enter the passcode again.';
  state.value = 'ready';
}

onMounted(() => {
  void checkAccess();
  window.addEventListener('nudgewise:access-required', handleAccessRequired);
});

onUnmounted(() => {
  window.removeEventListener('nudgewise:access-required', handleAccessRequired);
});
</script>

<template>
  <slot v-if="authenticated && state === 'ready'" />
  <main v-else class="flex min-h-screen items-center justify-center bg-orbyte-bg px-4 py-10 text-orbyte-ink">
    <section class="card w-full max-w-sm p-6 sm:p-8" aria-labelledby="demo-access-title">
      <h1 id="demo-access-title" class="text-xl font-semibold tracking-tight text-slate-900">Demo access</h1>

      <div v-if="state === 'loading'" class="mt-5 space-y-3" role="status" aria-label="Checking demo access">
        <div class="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
        <div class="h-9 animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div v-else-if="state === 'error'" class="mt-5">
        <p class="text-sm text-red-700" role="alert">{{ message }}</p>
        <button class="primary-btn mt-4" type="button" @click="checkAccess">Retry</button>
      </div>

      <form v-else class="mt-5" @submit.prevent="submitPasscode">
        <p class="mb-4 text-sm text-orbyte-muted">Enter the passcode to open the demo.</p>
        <label for="demo-passcode" class="form-label">Passcode</label>
        <input
          id="demo-passcode"
          v-model="passcode"
          class="form-input"
          type="password"
          name="passcode"
          autocomplete="current-password"
          required
          :disabled="submitting"
          :aria-describedby="message ? 'demo-access-message' : undefined"
        />
        <p v-if="message" id="demo-access-message" class="mt-3 text-sm text-red-700" role="alert">
          {{ message }}
        </p>
        <button class="primary-btn mt-5 w-full" type="submit" :disabled="submitting || !passcode">
          {{ submitting ? 'Checking…' : 'Continue' }}
        </button>
      </form>
    </section>
  </main>
</template>
