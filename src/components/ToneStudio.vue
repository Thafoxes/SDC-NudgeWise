<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Sparkles, RefreshCw, FileText, Languages } from 'lucide-vue-next';
import BaseModal from '@/components/BaseModal.vue';
import MessagePreview from '@/components/MessagePreview.vue';
import { TONES, LANGS, templateReminder, type Tone, type Lang, type ReminderFacts } from '@/presentation/toneStudio';
import { backendEnabled } from '@/services/commands';
import { rewriteReminder, type RewriteResult } from '@/services/rewrite';

const props = defineProps<{ open: boolean; followUpId: string | null; facts: ReminderFacts | null; currentMessage: string; defaultTone: Tone; savedLang: Lang }>();
const emit = defineEmits<{ close: []; apply: [text: string, rememberLang: Lang | null] }>();
const remember = ref(true);

const toneIndex = ref(0);
const tone = computed<Tone>(() => TONES[toneIndex.value].id);
const lang = ref<Lang>('en');
const result = ref<RewriteResult | null>(null);
const loading = ref(false);
let requestId = 0;

let debounce: ReturnType<typeof setTimeout> | undefined;

/** Shows the built-in wording instantly, then asks Gemma once the seller stops clicking. */
function generate(delay = 0) {
  if (!props.followUpId || !props.facts) return;
  const id = ++requestId;
  result.value = {
    text: templateReminder(props.facts, tone.value, lang.value),
    source: 'template',
    note: backendEnabled ? 'Asking Gemma for a fresh version…' : undefined,
  };
  if (!backendEnabled) { void finish(id); return; }
  loading.value = true;
  clearTimeout(debounce);
  debounce = setTimeout(() => void finish(id), delay);
}
async function finish(id: number) {
  if (!props.followUpId || !props.facts) return;
  const r = await rewriteReminder(props.followUpId, props.facts, tone.value, lang.value);
  if (id !== requestId) return; // a newer choice replaced this one
  result.value = r;
  loading.value = false;
}

watch(() => props.open, open => {
  if (open) {
    toneIndex.value = Math.max(0, TONES.findIndex(t => t.id === props.defaultTone));
    lang.value = props.savedLang;
    remember.value = true;
    result.value = null;
    generate();
  }
});
watch([toneIndex, lang], () => { if (props.open) generate(600); });

const preview = computed(() => result.value?.text ?? props.currentMessage);
</script>

<template>
  <BaseModal :open="open" title="Tone & language studio" width="max-w-2xl" @close="emit('close')">
    <div class="space-y-5">
      <p class="text-sm text-orbyte-muted">
        Choose how this reminder should sound. Amounts, dates and the invoice number always come from your records.
      </p>

      <!-- Tone slider -->
      <div>
        <label for="tone-slider" class="text-sm font-medium text-orbyte-ink">Tone
          <span class="font-normal text-orbyte-muted">· automatic for this stage: {{ TONES.find(t => t.id === defaultTone)?.label }}</span></label>
        <input
          id="tone-slider"
          v-model.number="toneIndex"
          type="range" min="0" max="2" step="1"
          class="mt-2 w-full accent-orbyte-button"
          :aria-valuetext="TONES[toneIndex].label"
        />
        <div class="mt-1 flex justify-between text-[13px]">
          <button
            v-for="(t, k) in TONES"
            :key="t.id"
            type="button"
            class="rounded px-1 transition"
            :class="toneIndex === k ? 'font-semibold text-orbyte-button' : 'text-orbyte-muted hover:text-orbyte-ink'"
            @click="toneIndex = k"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- Language -->
      <div>
        <p class="flex items-center gap-1.5 text-sm font-medium text-orbyte-ink"><Languages class="h-4 w-4 text-orbyte-muted" /> Language
          <span class="font-normal text-orbyte-muted">· {{ facts?.customerName }} prefers {{ LANGS.find(l => l.id === savedLang)?.label }}</span></p>
        <div class="mt-2 inline-flex rounded-lg border border-orbyte-border bg-white p-1" role="radiogroup" aria-label="Language">
          <button
            v-for="l in LANGS"
            :key="l.id"
            type="button"
            role="radio"
            :aria-checked="lang === l.id"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition"
            :class="lang === l.id ? 'bg-orbyte-ink text-white' : 'text-orbyte-muted hover:bg-orbyte-bg hover:text-orbyte-ink'"
            @click="lang = l.id"
          >
            {{ l.label }}
          </button>
        </div>
        <label v-if="lang !== savedLang" class="mt-2 flex items-center gap-2 text-[13px] text-orbyte-ink">
          <input v-model="remember" type="checkbox" class="rounded border-slate-300" />
          Always write to {{ facts?.customerName }} in {{ LANGS.find(l => l.id === lang)?.label }}
        </label>
      </div>

      <!-- Preview -->
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span
            v-if="result"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium"
            :class="result.source === 'ai' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'"
          >
            <Sparkles v-if="result.source === 'ai'" class="h-3.5 w-3.5" />
            <FileText v-else class="h-3.5 w-3.5" />
            {{ result.source === 'ai' ? 'Written by Gemma 4 · checked against invoice' : 'Built-in template' }}
          </span>
          <span v-else class="text-[13px] text-orbyte-muted">Preparing…</span>
          <button type="button" class="outline-btn !py-1.5 !text-sm" :disabled="loading" @click="generate()">
            <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" /> {{ loading ? 'Writing…' : 'Regenerate' }}
          </button>
        </div>
        <p v-if="result?.note" class="text-[13px] text-orbyte-muted">{{ result.note }}</p>
        <div :class="loading ? 'opacity-60 transition-opacity' : 'transition-opacity'">
          <MessagePreview :message="preview" :recipient-name="facts?.customerName" :sender-name="facts?.businessName" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-[13px] text-orbyte-muted">Using this message resets approval — you still approve before it is sent.</p>
        <div class="flex justify-end gap-2">
          <button class="outline-btn" @click="emit('close')">Cancel</button>
          <button class="primary-btn" :disabled="!result" @click="result && emit('apply', result.text, lang !== savedLang && remember ? lang : null)">Use this message</button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
