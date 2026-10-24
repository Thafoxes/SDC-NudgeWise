<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight } from 'lucide-vue-next';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import AttentionQueue from '@/components/AttentionQueue.vue';
import SellerWins from '@/components/SellerWins.vue';
import { getAttention } from '@/lib/attention';
import { blockedOrders } from '@/lib/orderWorkflow';
import { AlertTriangle } from 'lucide-vue-next';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID } from '@/lib/store';
import { computeInvoiceWithCustomer } from '@/lib/store';
import { calculateCustomerPriorities } from '@/lib/priorityEngine';
import type { PriorityLevel } from '@/lib/priorityEngine';
import { formatMYR, formatDate, sumMoney } from '@/lib/format';
import { formatShortPriorityReason, plural } from '@/presentation/display';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const { data } = useDemoStore();
const currentUser = computed(() => data.value.users.find(u => u.id === DEMO_SELLER_ID)!);
const currentBusiness = computed(() => data.value.businesses.find(b => b.id === DEMO_BUSINESS_ID));
const today = computed(() => data.value.demoState.simulated_date);
const bizId = computed(() => currentUser.value.business_id);

/* ---------- Source data (current business only; settled HIST-* history excluded) ---------- */
const allInvoices = computed(() =>
  data.value.invoices
    .filter(i => i.business_id === bizId.value)
    .map(i => computeInvoiceWithCustomer(i, data.value, today.value)),
);
const invoices = computed(() => allInvoices.value.filter(i => !i.invoice_number.startsWith('HIST-')));
const openInvoices = computed(() => invoices.value.filter(i => i.outstanding_balance > 0));
const overdueInvoices = computed(() => invoices.value.filter(i => i.status === 'overdue'));

/* ---------- Period (affects "Collected") ---------- */
const periods = [
  { id: 'month', label: 'This month' },
  { id: 'week', label: 'This week' },
  { id: 'today', label: 'Today' },
] as const;
type PeriodId = (typeof periods)[number]['id'];
const period = ref<PeriodId>('month');

function periodStart(): string {
  if (period.value === 'today') return today.value;
  if (period.value === 'month') return today.value.slice(0, 8) + '01';
  const d = new Date(today.value + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const recordedPayments = computed(() =>
  data.value.payments.filter(p => p.business_id === bizId.value && p.verification_status === 'recorded'),
);
const collected = computed(() =>
  sumMoney(recordedPayments.value.filter(p => p.payment_date >= periodStart() && p.payment_date <= today.value).map(p => p.amount)),
);

/* ---------- Work queue ---------- */
const pendingApprovals = computed(() =>
  data.value.followUpActions.filter(f => f.business_id === bizId.value && f.approval_state === 'pending' && f.send_state === 'not_sent'),
);
const attention = computed(() => getAttention(data.value, bizId.value, today.value));
const exceptions = computed(() => attention.value.filter(i => !['approval', 'overdue'].includes(i.kind)));

/* ---------- Customer health ---------- */
const priorities = computed(() => calculateCustomerPriorities(bizId.value, today.value, data.value));
const levelMeta: { id: PriorityLevel; label: string; color: string }[] = [
  { id: 'red', label: 'Needs attention', color: 'bg-rose-500' },
  { id: 'yellow', label: 'Follow-up due', color: 'bg-amber-400' },
  { id: 'green', label: 'Routine', color: 'bg-emerald-500' },
  { id: 'grey', label: 'New / limited history', color: 'bg-slate-300' },
];
const levelCounts = computed(() =>
  levelMeta.map(l => ({ ...l, count: priorities.value.filter(p => p.level === l.id).length })),
);
const topAttention = computed(() => priorities.value.filter(p => p.level === 'red').slice(0, 3));

/* ---------- KPIs ---------- */
const blocked = computed(() => { void data.value; return blockedOrders(bizId.value); });
const needsActionCount = computed(() => attention.value.length + blocked.value.length);
const outstandingTotal = computed(() => sumMoney(openInvoices.value.map(i => i.outstanding_balance)));
const overdueTotal = computed(() => sumMoney(overdueInvoices.value.map(i => i.outstanding_balance)));
const overduePct = computed(() => (outstandingTotal.value > 0 ? Math.round((overdueTotal.value / outstandingTotal.value) * 100) : 0));
const kpis = computed(() => [
  {
    label: 'Outstanding',
    value: formatMYR(outstandingTotal.value),
    sub: plural(openInvoices.value.length, 'open invoice'),
    to: '/invoices',
    tone: 'text-slate-900',
  },
  {
    label: 'Overdue',
    value: formatMYR(overdueTotal.value),
    sub: `${plural(overdueInvoices.value.length, 'invoice')} · ${overduePct.value}% of outstanding`,
    to: '/invoices?status=overdue',
    tone: overdueInvoices.value.length ? 'text-rose-600' : 'text-slate-900',
  },
  {
    label: 'Collected',
    value: formatMYR(collected.value),
    sub: periods.find(p => p.id === period.value)!.label,
    to: '/invoices?status=paid',
    tone: 'text-slate-900',
  },
  {
    label: 'Needs your action',
    value: String(needsActionCount.value),
    sub: `${plural(pendingApprovals.value.length, 'approval')} · ${plural(exceptions.value.length, 'exception')} · ${plural(blocked.value.length, 'blocked order')}`,
    to: '/action-center',
    tone: needsActionCount.value ? 'text-blue-700' : 'text-slate-900',
  },
]);

/* ---------- Overdue aging ---------- */
const aging = computed(() => {
  const buckets = [
    { label: '1–7 days', min: 1, max: 7, color: 'bg-blue-500' },
    { label: '8–14 days', min: 8, max: 14, color: 'bg-amber-400' },
    { label: '15–21 days', min: 15, max: 21, color: 'bg-orange-500' },
    { label: 'Over 21 days', min: 22, max: Infinity, color: 'bg-rose-500' },
  ].map(b => {
    const m = overdueInvoices.value.filter(i => i.days_overdue >= b.min && i.days_overdue <= b.max);
    return { ...b, count: m.length, amount: sumMoney(m.map(i => i.outstanding_balance)) };
  });
  const max = Math.max(1, ...buckets.map(b => b.amount));
  return buckets.map(b => ({ ...b, pct: Math.max(b.amount ? 2 : 0, Math.round((b.amount / max) * 100)) }));
});

/* ---------- Payments chart: last 30 days, daily ---------- */
const paymentsChart = computed(() => {
  const end = new Date(today.value + 'T12:00:00');
  const days: string[] = [];
  for (let k = 29; k >= 0; k--) {
    const d = new Date(end);
    d.setDate(d.getDate() - k);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const byDay = new Map<string, number>();
  for (const p of recordedPayments.value) byDay.set(p.payment_date, (byDay.get(p.payment_date) ?? 0) + p.amount);
  return {
    labels: days.map(d => new Date(d + 'T12:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Payments (MYR)',
      data: days.map(d => byDay.get(d) ?? 0),
      backgroundColor: '#1D4ED8',
      hoverBackgroundColor: '#1E40AF',
      borderRadius: 3,
      maxBarThickness: 14,
    }],
  };
});
const paymentsLast30 = computed(() => sumMoney(paymentsChart.value.datasets[0].data));
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#64748B', font: { size: 12 } } },
    y: { grid: { color: '#F1F5F9' }, border: { display: false }, ticks: { maxTicksLimit: 4, color: '#64748B', font: { size: 12 } } },
  },
};

</script>

<template>
  <div class="space-y-6">
    <!-- Context + period -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-600">{{ currentBusiness?.name }} · as of {{ formatDate(today) }}</p>
      <div class="inline-flex self-start rounded-lg border border-slate-200 bg-white p-1 sm:self-auto" role="tablist" aria-label="Reporting period">
        <button
          v-for="p in periods"
          :key="p.id"
          role="tab"
          :aria-selected="period === p.id"
          class="rounded-md px-3 py-1.5 text-xs font-medium transition"
          :class="period === p.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
          @click="period = p.id"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <RouterLink v-if="blocked.length" to="/action-center?tab=blocked" class="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 transition hover:border-rose-300" aria-label="Blocked orders">
      <span class="flex items-start gap-3"><AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <span><span class="block text-sm font-semibold text-rose-900">{{ plural(blocked.length, 'order') }} blocked from invoicing or follow-up</span>
          <span class="block text-[13px] text-rose-800">{{ blocked[0].order.reference }}: {{ blocked[0].blockers[0].reason }}<template v-if="blocked.length > 1"> · and {{ blocked.length - 1 }} more</template></span></span></span>
      <span class="shrink-0 text-sm font-medium text-rose-700">Review <ArrowRight class="inline h-4 w-4" /></span>
    </RouterLink>

    <!-- KPIs -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RouterLink v-for="k in kpis" :key="k.label" :to="k.to" class="card group block p-5 transition hover:border-slate-300">
        <div class="flex items-center justify-between">
          <p class="text-xs font-medium text-slate-600">{{ k.label }}</p>
          <ArrowRight class="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
        </div>
        <p class="mt-2 text-2xl font-semibold tracking-tight tabular-nums" :class="k.tone">{{ k.value }}</p>
        <p class="mt-1 text-[13px] text-slate-500">{{ k.sub }}</p>
      </RouterLink>
    </div>

    <!-- Seller wins: monthly goal, time saved, this week -->
    <SellerWins :business-id="bizId" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <!-- Today's priorities -->
      <AttentionQueue :limit="5" class="xl:col-span-2" />

      <!-- Customer health -->
      <section class="card flex flex-col">
        <header class="border-b border-slate-100 px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900">Customer health</h2>
          <p class="mt-0.5 text-[13px] text-slate-500">{{ plural(priorities.length, 'customer') }} · rule-based, not a credit score</p>
        </header>
        <div class="space-y-4 px-5 py-4">
          <div class="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              v-for="l in levelCounts"
              :key="l.id"
              :class="l.color"
              :style="{ width: priorities.length ? (l.count / priorities.length) * 100 + '%' : '0%' }"
            ></div>
          </div>
          <ul class="space-y-2">
            <li v-for="l in levelCounts" :key="l.id">
              <RouterLink :to="`/customers?level=${l.id}`" class="flex items-center gap-2.5 rounded text-xs text-slate-700 hover:text-slate-900">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="l.color"></span>
                <span>{{ l.label }}</span>
                <span class="ml-auto font-semibold tabular-nums text-slate-900">{{ l.count }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
        <div class="flex-1 border-t border-slate-100 px-5 py-4">
          <p class="text-[13px] font-medium text-slate-500">Most urgent</p>
          <ul class="mt-2 space-y-2.5">
            <li v-for="p in topAttention" :key="p.customerId" class="min-w-0">
              <span class="block truncate text-sm font-medium text-slate-900">{{ p.customerName }}</span>
              <span class="block truncate text-[13px] text-slate-500">{{ formatShortPriorityReason(p, invoices) }}</span>
            </li>
            <li v-if="!topAttention.length" class="text-[13px] text-slate-500">No customers need urgent attention.</li>
          </ul>
        </div>
        <RouterLink to="/customers" class="block border-t border-slate-100 px-5 py-3 text-center text-xs font-medium text-slate-600 hover:bg-slate-50">
          View all customers
        </RouterLink>
      </section>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Overdue aging -->
      <section class="card">
        <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-slate-900">Overdue by age</h2>
            <p class="mt-0.5 text-[13px] text-slate-500">{{ plural(overdueInvoices.length, 'overdue invoice') }} · {{ formatMYR(overdueTotal) }}</p>
          </div>
          <RouterLink to="/invoices?status=overdue" class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
            Invoices <ArrowRight class="h-4 w-4" />
          </RouterLink>
        </header>
        <ul class="space-y-4 px-5 py-5">
          <li v-for="b in aging" :key="b.label">
            <div class="flex items-baseline justify-between text-xs">
              <span class="text-slate-700">{{ b.label }} <span class="text-slate-400">· {{ plural(b.count, 'invoice') }}</span></span>
              <span class="font-semibold text-slate-900 tabular-nums">{{ formatMYR(b.amount) }}</span>
            </div>
            <div class="mt-1.5 h-2 rounded-full bg-slate-100">
              <div class="h-2 rounded-full" :class="b.color" :style="{ width: b.pct + '%' }"></div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Payments -->
      <section class="card">
        <header class="border-b border-slate-100 px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900">Payments received</h2>
          <p class="mt-0.5 text-[13px] text-slate-500">Last 30 days · {{ formatMYR(paymentsLast30) }}</p>
        </header>
        <div class="h-[232px] px-4 py-4">
          <Bar :data="paymentsChart" :options="chartOptions" />
        </div>
      </section>
    </div>


  </div>
</template>
