<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Search, Eye, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import StatusBadge from '@/components/StatusBadge.vue';
import InvoiceDetailDrawer from '@/components/InvoiceDetailDrawer.vue';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID } from '@/lib/store';
import { computeInvoiceWithCustomer } from '@/lib/store';
import { calculateCustomerPriorities } from '@/lib/priorityEngine';
import type { CustomerPriority, PriorityLevel } from '@/lib/priorityEngine';
import { formatMYR, formatDate, sumMoney } from '@/lib/format';
import { getDerivedLabelChips, formatShortPriorityReason, plural } from '@/presentation/display';
import type { InvoiceWithCustomer } from '@/types';
import { RouterLink,useRoute } from 'vue-router';

const { data } = useDemoStore();
const currentUser = computed(() => data.value.users.find(u => u.id === DEMO_SELLER_ID)!);
const currentBusiness = computed(() => data.value.businesses.find(b => b.id === DEMO_BUSINESS_ID));
const route = useRoute();
const today = computed(() => data.value.demoState.simulated_date);

const invoices = computed(() =>
  data.value.invoices
    .filter(i => i.business_id === currentUser.value.business_id)
    .map(i => computeInvoiceWithCustomer(i, data.value, today.value))
);
const outstandingByCurrency=computed(()=>{
 const totals=new Map<string,number>();for(const i of invoices.value)totals.set(i.currency||'MYR',(totals.get(i.currency||'MYR')||0)+i.outstanding_balance);
 return [...totals].map(([currency,amount])=>formatMYR(amount,currency)).join(' · ');
});
const priorityRecords = computed(() => calculateCustomerPriorities(currentUser.value.business_id, today.value, data.value));
const priorityMap = computed(() => new Map(priorityRecords.value.map(p => [p.customerId, p])));

function priorityBadgeClass(level: PriorityLevel) {
  return {
    red: 'bg-rose-50 text-rose-700',
    yellow: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    grey: 'bg-slate-100 text-slate-600',
  }[level];
}

const selectedId = ref<string | null>(null);
const drawerOpen = ref(false);
const selectedInvoice = computed(() => invoices.value.find(i => i.id === selectedId.value) ?? null);
function openInvoice(i: InvoiceWithCustomer | null | undefined) {
  if (!i) return;
  selectedId.value = i.id;
  drawerOpen.value = true;
}

let openedFromQuery='';
watch(()=>[route.query.invoice,invoices.value],()=>{
 const id=route.query.invoice;if(typeof id!=='string'){openedFromQuery='';return;}
 if(id===openedFromQuery)return;const invoice=invoices.value.find(i=>i.id===id);
 if(invoice){openedFromQuery=id;openInvoice(invoice);}
},{immediate:true});

// Filters (status can come from the dashboard link, e.g. #/invoices?status=overdue)
const search = ref('');
const statusFilter = ref(typeof route.query.status === 'string' ? route.query.status : 'all');
const sortBy = ref<'overdue' | 'dueDate' | 'outstanding'>('overdue');
const showSettledHistory = ref(false);
const currentPage = ref(0);
const pageSize = 12;

const filteredInvoices = computed(() => {
  let list = invoices.value;
  if (!showSettledHistory.value) list = list.filter(i => !i.invoice_number.startsWith('HIST-'));
  if (statusFilter.value !== 'all') list = list.filter(i => i.status === statusFilter.value);
  if (search.value.trim()) {
    const q = search.value.toLowerCase().trim();
    list = list.filter(i => i.invoice_number.toLowerCase().includes(q) || (i.customer?.name.toLowerCase().includes(q) ?? false));
  }
  return [...list].sort((a, b) => {
    if (sortBy.value === 'overdue') return b.days_overdue - a.days_overdue || a.due_date.localeCompare(b.due_date);
    if (sortBy.value === 'dueDate') return a.due_date.localeCompare(b.due_date);
    return b.outstanding_balance - a.outstanding_balance;
  });
});
const pages = computed(() => Math.max(1, Math.ceil(filteredInvoices.value.length / pageSize)));
const pageData = computed(() => {
  const page = Math.min(currentPage.value, pages.value - 1);
  return filteredInvoices.value.slice(page * pageSize, (page + 1) * pageSize);
});
watch([search, statusFilter, sortBy, showSettledHistory], () => (currentPage.value = 0));

const totals = computed(() => ({
  count: filteredInvoices.value.length,
  outstanding: sumMoney(filteredInvoices.value.map(i => i.outstanding_balance)),
}));
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <p class="text-sm text-slate-600">{{ currentBusiness?.name }} · {{ plural(totals.count, 'invoice') }} · {{ outstandingByCurrency }} outstanding</p>
      <RouterLink to="/quick-sale" class="primary-btn">New quick sale / invoice</RouterLink>
    </div>

    <!-- Invoice Table Section -->
    <section class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <h2 class="text-base font-semibold text-slate-900">Invoices</h2>

        <!-- Filters and search -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative w-full sm:w-auto">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Search invoices" v-model="search"
              placeholder="Filter invoices..."
              class="form-input !mt-0 pl-8 !py-1 text-xs sm:max-w-[170px]"
            />
          </div>

          <select aria-label="Invoice status" v-model="statusFilter" class="form-input !mt-0 !py-1 text-xs w-auto">
            <option value="all">All statuses</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>

          <select aria-label="Sort invoices" v-model="sortBy" class="form-input !mt-0 !py-1 text-xs w-auto">
            <option value="overdue">Sort: Overdue days</option>
            <option value="dueDate">Sort: Due date</option>
            <option value="outstanding">Sort: Outstanding</option>
          </select>

          <label class="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none ml-1">
            <input
              type="checkbox"
              v-model="showSettledHistory"
              class="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            <span>Settled history</span>
          </label>
        </div>
      </div>

      <!-- Mobile: invoice cards -->
      <ul class="divide-y divide-slate-100 md:hidden">
        <li v-for="i in pageData" :key="'m-' + i.id">
          <button type="button" class="w-full px-4 py-3 text-left hover:bg-slate-50" @click="openInvoice(i)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-slate-900">{{ i.customer?.name || '—' }}</p>
                <p class="mt-0.5 font-mono text-[13px] text-slate-500">{{ i.invoice_number }}</p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-xs font-semibold text-slate-900 tabular-nums">{{ formatMYR(i.outstanding_balance,i.currency) }}</p>
                <p class="text-[12px] text-slate-400 tabular-nums">of {{ formatMYR(i.invoice_amount,i.currency) }}</p>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge :status="i.status" />
              <span v-for="chip in getDerivedLabelChips(i)" :key="chip.text" class="rounded px-1.5 py-0.5 text-[12px] font-medium" :class="chip.className">{{ chip.text }}</span>
              <span v-if="priorityMap.get(i.customer_id)" class="rounded px-1.5 py-0.5 text-[12px] font-medium" :class="priorityBadgeClass(priorityMap.get(i.customer_id)!.level)">{{ priorityMap.get(i.customer_id)!.label }}</span>
            </div>
            <p class="mt-1.5 text-[13px] text-slate-500 tabular-nums">
              Due {{ formatDate(i.due_date) }}
              <span v-if="i.days_overdue > 0" class="font-medium text-rose-600">· {{ i.days_overdue }}d overdue</span>
            </p>
          </button>
          <a v-if="i.purchase_order_id" :href="`#/orders/${i.purchase_order_id}/view`" class="mx-4 mb-3 inline-block text-xs text-blue-700 underline">View order and items</a>
        </li>
        <li v-if="!pageData.length" class="p-6 text-center text-xs text-slate-400">No invoices match the selected criteria.</li>
      </ul>

      <!-- Compact Invoices Table -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-100 text-slate-400 font-medium">
              <th class="px-4 py-2.5">Invoice</th>
              <th class="px-4 py-2.5">Customer</th>
              <th class="px-4 py-2.5 text-right">Amount</th>
              <th class="px-4 py-2.5 text-right">Outstanding</th>
              <th class="px-4 py-2.5">Due date</th>
              <th class="px-4 py-2.5">Status</th>
              <th class="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="i in pageData"
              :key="i.id"
              class="hover:bg-slate-50/60 transition cursor-pointer"
              @click="openInvoice(i)"
            >
              <td class="px-4 py-2 font-mono font-medium text-slate-900">{{ i.invoice_number }}</td>
              <td class="px-4 py-2 font-medium text-slate-800">{{ i.customer?.name || '—' }}</td>
              <td class="px-4 py-2 text-right tabular-nums text-slate-500">{{ formatMYR(i.invoice_amount,i.currency) }}</td>
              <td class="px-4 py-2 text-right tabular-nums font-semibold" :class="i.outstanding_balance > 0 ? 'text-slate-900' : 'text-slate-400'">
                {{ formatMYR(i.outstanding_balance,i.currency) }}
              </td>
              <td class="px-4 py-2 text-slate-600 tabular-nums">
                {{ formatDate(i.due_date) }}
                <span v-if="i.days_overdue > 0" class="text-[12px] text-rose-600 font-medium ml-1">
                  ({{ i.days_overdue }}d overdue)
                </span>
              </td>
              <td class="px-4 py-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge :status="i.status" />
                  <span
                    v-for="chip in getDerivedLabelChips(i)"
                    :key="chip.text"
                    class="rounded px-1.5 py-0.5 text-[12px] font-medium"
                    :class="chip.className"
                  >
                    {{ chip.text }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-2 text-right" @click.stop>
                <a v-if="i.purchase_order_id" :href="`#/orders/${i.purchase_order_id}/view`" class="outline-btn mr-2">View order</a>
                <button
                  class="text-blue-700 hover:text-blue-800 text-[13px] font-medium inline-flex items-center gap-1"
                  @click="openInvoice(i)"
                >
                  <Eye class="w-3.5 h-3.5" /> View
                </button>
              </td>
            </tr>
            <tr v-if="!pageData.length">
              <td colspan="7" class="p-6 text-center text-slate-400">
                No invoices match the selected criteria.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span class="tabular-nums">Page {{ Math.min(currentPage + 1, pages) }} of {{ pages }} ({{ plural(filteredInvoices.length, 'invoice') }})</span>
        <div class="flex gap-1">
          <button
            class="outline-btn !p-1.5"
            :disabled="currentPage <= 0"
            @click="currentPage--"
            aria-label="Previous page"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>
          <button
            class="outline-btn !p-1.5"
            :disabled="currentPage >= pages - 1"
            @click="currentPage++"
            aria-label="Next page"
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>

    <InvoiceDetailDrawer
      :invoice="selectedInvoice"
      :open="drawerOpen"
      :seller-name="currentUser.name"
      :seller-role="currentUser.role"
      @close="drawerOpen = false"
    />
  </div>
</template>
