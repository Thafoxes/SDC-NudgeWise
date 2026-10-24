<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { PartyPopper, X } from 'lucide-vue-next';
import { useDemoStore } from '@/composables/useDemoStore';
import { computeInvoiceWithCustomer } from '@/lib/store';
import { formatMYR } from '@/lib/format';
import { backendEnabled, integration } from '@/services/commands';

/** Shows a short celebration when an open invoice becomes fully paid. */
const props = defineProps<{ businessId: string }>();
const { data } = useDemoStore();

const paid = computed(() => {
  const today = data.value.demoState.simulated_date;
  return data.value.invoices
    .filter(i => i.business_id === props.businessId && !i.invoice_number.startsWith('HIST-'))
    .map(i => computeInvoiceWithCustomer(i, data.value, today))
    .filter(i => i.outstanding_balance <= 0);
});

interface Win { id: string; text: string; amount: number }
const wins = ref<Win[]>([]);
const confetti = ref(false);
let known = new Set<string>();
let armed = false; // ignore the first data loads (seed / server snapshot)
let armTimer: ReturnType<typeof setTimeout> | undefined;
let confettiTimer: ReturnType<typeof setTimeout> | undefined;
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function arm() {
  clearTimeout(armTimer);
  armTimer = setTimeout(() => { known = new Set(paid.value.map(i => i.id)); armed = true; }, 1500);
}
onMounted(() => {
  known = new Set(paid.value.map(i => i.id));
  // With the backend, wait for the first server snapshot so invoices that were
  // already paid when the page opened never trigger a celebration.
  if (!backendEnabled) arm();
});
const stopArmWatch = watch(integration, () => { if (backendEnabled && !armed) { arm(); stopArmWatch(); } });
onUnmounted(() => { clearTimeout(armTimer); clearTimeout(confettiTimer); });

watch(paid, list => {
  const fresh = list.filter(i => !known.has(i.id));
  known = new Set(list.map(i => i.id));
  if (!armed || !fresh.length) return;
  for (const inv of fresh) {
    const id = inv.id + Date.now();
    wins.value = [...wins.value.slice(-1), { id, amount: inv.invoice_amount, text: `${inv.invoice_number} from ${inv.customer?.name ?? 'customer'} is fully paid` }];
    setTimeout(() => { wins.value = wins.value.filter(w => w.id !== id); }, 7000);
  }
  if (!reducedMotion) {
    confetti.value = true;
    clearTimeout(confettiTimer);
    confettiTimer = setTimeout(() => (confetti.value = false), 2200);
  }
});

const pieces = Array.from({ length: 36 }, (_, k) => ({
  left: (k * 37) % 100,
  delay: (k % 9) * 0.08,
  color: ['#1D4ED8', '#059669', '#F59E0B', '#E11D48', '#7C3AED'][k % 5],
  rotate: (k * 47) % 360,
}));
</script>

<template>
  <div v-if="confetti" class="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
    <span
      v-for="(p, k) in pieces"
      :key="k"
      class="confetti-piece"
      :style="{ left: p.left + '%', background: p.color, animationDelay: p.delay + 's', transform: `rotate(${p.rotate}deg)` }"
    ></span>
  </div>
  <div class="pointer-events-none fixed bottom-6 left-1/2 z-[85] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
    <div
      v-for="w in wins"
      :key="w.id"
      role="status"
      class="pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-popover"
    >
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><PartyPopper class="h-5 w-5" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-slate-900">{{ formatMYR(w.amount) }} collected!</p>
        <p class="truncate text-[13px] text-slate-600">{{ w.text }}</p>
      </div>
      <button type="button" class="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Dismiss" @click="wins = wins.filter(x => x.id !== w.id)">
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.confetti-piece {
  position: absolute;
  top: -12px;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.9;
  animation: confetti-fall 1.9s cubic-bezier(0.2, 0.6, 0.4, 1) forwards;
}
@keyframes confetti-fall {
  to { transform: translateY(105vh) rotate(540deg); opacity: 0.2; }
}
</style>
