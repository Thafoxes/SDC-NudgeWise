<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Search, Eye, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-vue-next';
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
import { useRoute, useRouter } from 'vue-router';
import { LANGS, customerLang, type Lang } from '@/lib/reminderTemplates';
import { setCustomerLanguage, updateCustomer, deleteCustomer } from '@/services/commands';
import CustomerIntake from '@/components/CustomerIntake.vue';
import { getOrderEligibility } from '@/lib/customerOrders';

const { data, refreshStore } = useDemoStore();
const currentUser = computed(() => data.value.users.find(u => u.id === DEMO_SELLER_ID)!);
const currentBusiness = computed(() => data.value.businesses.find(b => b.id === DEMO_BUSINESS_ID));
const route = useRoute();
const router = useRouter();
const recordId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const recordMode = computed(() => route.params.mode === 'edit' ? 'edit' : 'view');
const recordPage = computed(() => !!recordId.value);
const recordCustomer = computed(() => data.value.customers.find(c => c.id === recordId.value && c.business_id === DEMO_BUSINESS_ID));
watch([recordId, recordMode], () => { if (recordId.value && recordMode.value === 'edit') editCustomer(recordId.value); }, { immediate: true });
const today = computed(() => data.value.demoState.simulated_date);

const invoices = computed(() =>
  data.value.invoices
    .filter(i => i.business_id === currentUser.value.business_id)
    .map(i => computeInvoiceWithCustomer(i, data.value, today.value))
);
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

const levelFilter = ref<'all' | PriorityLevel>(
  (['red', 'yellow', 'green', 'grey'] as const).includes(route.query.level as PriorityLevel) ? (route.query.level as PriorityLevel) : 'all'
);
const levels = computed(() => ([
  { id: 'all', label: 'All' },
  { id: 'red', label: 'Needs attention' },
  { id: 'yellow', label: 'Follow-up due' },
  { id: 'green', label: 'Routine monitoring' },
  { id: 'grey', label: 'Insufficient history' },
] as const).map(l => ({ ...l, count: l.id === 'all' ? priorityRecords.value.length : priorityRecords.value.filter(p => p.level === l.id).length })));

const priorityList = computed(() => [...priorityRecords.value].sort((a, b) => {
  const rank: Record<PriorityLevel, number> = { red: 0, yellow: 1, grey: 2, green: 3 };
  return rank[a.level] - rank[b.level] || a.customerName.localeCompare(b.customerName);
}));
const visiblePriorities = computed(() => levelFilter.value === 'all' ? priorityList.value : priorityList.value.filter(p => p.level === levelFilter.value));
const expandedPriority = ref<string | null>(null);

function priorityInvoiceRefs(priority: CustomerPriority) {
  return priority.supportingInvoiceIds.map(id => invoices.value.find(i => i.id === id)?.invoice_number ?? id).join(', ') || 'None';
}
function langOf(customerId: string): Lang {
  return customerLang(data.value.customers.find(c => c.id === customerId));
}
const langNotice = ref('');
const intakeCustomerId = ref<string | null>(null);
const intakeCustomer = computed(() => data.value.customers.find(customer => customer.id === intakeCustomerId.value));
const intakeEligibility = computed(() => {
  void data.value;
  return intakeCustomerId.value ? getOrderEligibility(intakeCustomerId.value, DEMO_BUSINESS_ID) : null;
});
let langTimer: ReturnType<typeof setTimeout> | undefined;
async function changeLang(customerId: string, name: string, event: Event) {
  const lang = (event.target as HTMLSelectElement).value;
  const r = await setCustomerLanguage(customerId, lang, currentUser.value.name, currentUser.value.role, DEMO_BUSINESS_ID);
  const label = LANGS.find(l => l.id === lang)?.label ?? lang;
  langNotice.value = r.success
    ? `${name}: reminders will be written in ${label}${r.redrafted ? ` (${r.redrafted} draft${r.redrafted === 1 ? '' : 's'} rewritten)` : ''}.`
    : r.error || 'Could not save language';
  clearTimeout(langTimer);
  langTimer = setTimeout(() => (langNotice.value = ''), 4000);
  refreshStore();
}
const managingCustomer=ref<string|null>(null);
const customerBusy=ref(false);
const customerError=ref('');
const customerNotice=ref('');
const customerEdit=ref({name:'',phone:'',email:'',address:''});
function editCustomer(id:string){const c=data.value.customers.find(c=>c.id===id);if(!c)return;
  managingCustomer.value=id;customerError.value='';customerNotice.value='';customerEdit.value={name:c.name,phone:c.phone||'',email:c.email||'',address:c.address||''};}
async function saveCustomerEdit(){if(!managingCustomer.value||customerBusy.value)return;
  customerBusy.value=true;customerError.value='';
  try{const r=await updateCustomer(managingCustomer.value,{...customerEdit.value},currentUser.value.name,currentUser.value.role,DEMO_BUSINESS_ID);
    if(!r.success)throw new Error(r.error||'Could not update customer');const savedId=managingCustomer.value;refreshStore();managingCustomer.value=null;customerNotice.value='Customer updated.';await router.push(`/customers/${encodeURIComponent(savedId)}/view`);
  }catch(e){customerError.value=e instanceof Error?e.message:'Could not update customer';}finally{customerBusy.value=false;}}
async function removeCustomer(id:string){const c=data.value.customers.find(c=>c.id===id);if(!c||customerBusy.value||!window.confirm(`Delete customer ${c.name}? This cannot be undone.`))return;
  customerBusy.value=true;customerError.value='';
  try{const r=await deleteCustomer(id,currentUser.value.name,currentUser.value.role,DEMO_BUSINESS_ID);
    if(!r.success)throw new Error(r.error||'Could not delete customer');if(managingCustomer.value===id)managingCustomer.value=null;
    if(recordPage.value) await router.push('/customers');
    refreshStore();customerNotice.value=`Customer ${c.name} deleted.`;
  }catch(e){customerError.value=e instanceof Error?e.message:'Could not delete customer';}finally{customerBusy.value=false;}}
function outstandingFor(customerId: string) {
  return sumMoney(invoices.value.filter(i => i.customer_id === customerId).map(i => i.outstanding_balance));
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="recordPage" class="space-y-5">
      <div class="flex items-center justify-between"><button class="outline-btn" @click="router.push('/customers')">← Back to Customers</button><div class="flex gap-2" v-if="recordCustomer"><button v-if="recordMode === 'view'" class="primary-btn" @click="router.push(`/customers/${encodeURIComponent(recordId)}/edit`)">Edit Customer</button><button v-else class="outline-btn" @click="router.push(`/customers/${encodeURIComponent(recordId)}/view`)">View Details</button></div></div>
      <section v-if="recordMode === 'view' && recordCustomer" class="card p-5 space-y-4"><h2 class="text-lg font-semibold">{{ recordCustomer.name }}</h2><dl class="grid gap-4 sm:grid-cols-2 text-sm"><div><dt class="text-slate-500">Phone</dt><dd>{{recordCustomer.phone || '—'}}</dd></div><div><dt class="text-slate-500">Email</dt><dd>{{recordCustomer.email || '—'}}</dd></div><div><dt class="text-slate-500">Address</dt><dd>{{recordCustomer.address || '—'}}</dd></div><div><dt class="text-slate-500">Outstanding balance</dt><dd>{{formatMYR(outstandingFor(recordId))}}</dd></div></dl></section>
      <p v-if="!recordCustomer" class="card p-5 text-rose-700">Customer not found.</p>
      <p v-if="customerError" role="alert" class="text-rose-700">{{customerError}}</p>
      <p v-if="customerNotice" role="status" class="text-emerald-700">{{customerNotice}}</p>
      <section v-if="recordMode === 'edit' && recordCustomer && managingCustomer" class="card p-5 space-y-4"><h2 class="font-semibold">Edit Customer — {{recordCustomer.name}}</h2><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm">Name *<input v-model="customerEdit.name" class="form-input" required /></label><label class="text-sm">Phone *<input v-model="customerEdit.phone" class="form-input" required /></label><label class="text-sm">Email<input v-model="customerEdit.email" type="email" class="form-input" /></label><label class="text-sm">Address<input v-model="customerEdit.address" class="form-input" /></label></div><button class="primary-btn" :disabled="customerBusy" @click="saveCustomerEdit">Save changes</button></section>
    </div>
    <template v-else>
    <CustomerIntake @selected="intakeCustomerId = $event" />
    <p v-if="customerError" role="alert" class="text-sm text-rose-700">{{customerError}}</p><p v-if="customerNotice" role="status" class="text-sm text-emerald-700">{{customerNotice}}</p>
    <section v-if="false && managingCustomer" class="card p-4 space-y-3" aria-label="Edit customer"><div class="flex justify-between"><h2 class="font-semibold">Edit customer</h2><button class="outline-btn" @click="managingCustomer=null">Close</button></div>
      <div class="grid gap-3 sm:grid-cols-2"><label class="text-sm">Name <span class="text-rose-600">*</span><input v-model="customerEdit.name" class="form-input" maxlength="120" /></label><label class="text-sm">Phone <span class="text-rose-600">*</span><input v-model="customerEdit.phone" class="form-input" placeholder="0123456789" /></label><label class="text-sm">Email<input v-model="customerEdit.email" type="email" class="form-input" placeholder="name@company.com" /></label><label class="text-sm">Address<input v-model="customerEdit.address" class="form-input" /></label></div><button class="primary-btn" :disabled="customerBusy" @click="saveCustomerEdit">Save changes</button>
    </section>
    <div v-if="intakeCustomer && intakeEligibility" class="rounded-lg border p-4 text-sm" :class="intakeEligibility.allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'">
      <p class="font-semibold">{{ intakeCustomer.name }} · {{ intakeEligibility.allowed ? 'Eligible for a new order' : 'Order hold' }}</p>
      <p v-if="!intakeEligibility.allowed" class="mt-1">Previous disputed invoices require resolution and settlement, or a seller override for the specific PO.</p>
      <RouterLink :to="{ path: '/orders', query: { customer: intakeCustomer.id } }" class="mt-2 inline-block font-medium underline">Review purchase order eligibility</RouterLink>
    </div>
    <p v-if="langNotice" role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{{ langNotice }}</p>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-600">Follow-up priority is rule-based and explainable — it is not a credit score and never bypasses reminder approval.</p>
    </div>
    <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by priority">
      <button
        v-for="l in levels"
        :key="l.id"
        role="tab"
        :aria-selected="levelFilter === l.id"
        class="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
        :class="levelFilter === l.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
        @click="levelFilter = l.id"
      >
        {{ l.label }} <span class="ml-1 tabular-nums opacity-70">{{ l.count }}</span>
      </button>
    </div>

    <!-- Customer Priorities Section -->
    <section class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-slate-900">
            Customer follow-up priorities
          </h2>
        </div>
        <span class="text-[13px] text-slate-500 tabular-nums">{{ plural(visiblePriorities.length, 'customer') }}</span>
      </div>

      <!-- Mobile: stacked cards -->
      <ul class="divide-y divide-slate-100 md:hidden">
        <li v-for="p in visiblePriorities" :key="'m-' + p.customerId" class="px-4 py-3">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs font-semibold text-slate-900">{{ p.customerName }}</p>
            <span class="shrink-0 rounded px-2 py-0.5 text-[12px] font-medium" :class="priorityBadgeClass(p.level)">{{ p.label }}</span>
          </div>
          <p class="mt-1 text-[13px] text-slate-600">{{ formatShortPriorityReason(p, invoices) }}</p>
          <label class="mt-2 flex items-center gap-2 text-[13px] text-slate-500">
            Reminder language
            <select class="form-input !mt-0 !w-auto !py-1 text-[13px]" :value="langOf(p.customerId)" @change="changeLang(p.customerId, p.customerName, $event)">
              <option v-for="l in LANGS" :key="l.id" :value="l.id">{{ l.label }}</option>
            </select>
          </label>
          <div class="mt-2 flex gap-2"><button class="rounded p-1.5 text-slate-700" :aria-label="`View customer ${p.customerName}`" @click="router.push(`/customers/${encodeURIComponent(p.customerId)}/view`)"><Eye class="h-4 w-4"/></button><button class="rounded p-1.5 text-blue-700" :aria-label="`Edit customer ${p.customerName}`" @click="router.push(`/customers/${encodeURIComponent(p.customerId)}/edit`)"><Pencil class="h-4 w-4"/></button><button class="rounded p-1.5 text-rose-600" :aria-label="`Delete customer ${p.customerName}`" @click="removeCustomer(p.customerId)"><Trash2 class="h-4 w-4"/></button></div>
          <button
            class="mt-1.5 text-[13px] font-medium text-blue-700"
            :aria-expanded="expandedPriority === p.customerId"
            @click="expandedPriority = expandedPriority === p.customerId ? null : p.customerId"
          >
            {{ expandedPriority === p.customerId ? 'Hide details' : 'Explain' }}
          </button>
          <div v-if="expandedPriority === p.customerId" class="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5 text-[13px] text-slate-600">
            <p><strong>Supporting invoices:</strong> {{ priorityInvoiceRefs(p) }}</p>
            <p><strong>Last 5 settled:</strong> {{ p.settledCount }} · <strong>Late:</strong> {{ p.lateCount }}</p>
            <p v-for="flag in p.reviewFlags" :key="flag" class="font-medium text-amber-700">⚠ {{ flag }}</p>
          </div>
        </li>
        <li v-if="!visiblePriorities.length" class="p-4 text-center text-xs text-slate-400">No customer priorities in this view.</li>
      </ul>

      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-100 text-slate-400 font-medium">
              <th class="px-4 py-2.5">Customer</th>
              <th class="px-4 py-2.5">Priority</th>
              <th class="px-4 py-2.5">Reason</th>
              <th class="px-4 py-2.5">Reminder language</th>
              <th class="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-for="p in visiblePriorities" :key="p.customerId">
              <tr class="hover:bg-slate-50/60 transition">
                <td class="px-4 py-2 font-medium text-slate-900">{{ p.customerName }}</td>
                <td class="px-4 py-2">
                  <span class="rounded px-2 py-0.5 text-[12px] font-medium" :class="priorityBadgeClass(p.level)">
                    {{ p.label }}
                  </span>
                </td>
                <td class="px-4 py-2 text-slate-600 max-w-sm truncate">
                  {{ formatShortPriorityReason(p, invoices) }}
                </td>
                <td class="px-4 py-2">
                  <select
                    class="form-input !mt-0 !w-auto !py-1 text-[13px]"
                    :value="langOf(p.customerId)"
                    :aria-label="`Reminder language for ${p.customerName}`"
                    @change="changeLang(p.customerId, p.customerName, $event)"
                  >
                    <option v-for="l in LANGS" :key="l.id" :value="l.id">{{ l.label }}</option>
                  </select>
                </td>
                <td class="px-4 py-2 text-right">
                  <div class="flex justify-end gap-2"><button class="rounded p-1.5 text-slate-700 hover:bg-slate-100" :aria-label="`View customer ${p.customerName}`" title="View customer" @click="router.push(`/customers/${encodeURIComponent(p.customerId)}/view`)"><Eye class="h-4 w-4"/></button><button class="rounded p-1.5 text-blue-700 hover:bg-blue-50" :aria-label="`Edit customer ${p.customerName}`" title="View / edit customer" @click="router.push(`/customers/${encodeURIComponent(p.customerId)}/edit`)"><Pencil class="h-4 w-4"/></button><button class="rounded p-1.5 text-rose-600 hover:bg-rose-50" :aria-label="`Delete customer ${p.customerName}`" title="Delete customer" @click="removeCustomer(p.customerId)"><Trash2 class="h-4 w-4"/></button></div>
                </td>
              </tr>
              <tr v-if="expandedPriority === p.customerId" class="bg-slate-50/80">
                <td colspan="5" class="px-4 py-3 text-[13px] text-slate-600 space-y-1.5">
                  <p><strong>Supporting invoices:</strong> {{ priorityInvoiceRefs(p) }}</p>
                  <p><strong>Last 5 settled:</strong> {{ p.settledCount }} · <strong>Late:</strong> {{ p.lateCount }}</p>
                  <p v-for="x in p.lastFiveSettled" :key="x.invoiceId" class="text-slate-500">
                    {{ x.invoiceNumber }}: due {{ formatDate(x.dueDate) }}, settled {{ formatDate(x.settledDate) }} — {{ x.late ? `Late (${x.daysLate}d)` : 'On time' }}
                  </p>
                  <p v-for="flag in p.reviewFlags" :key="flag" class="text-amber-700 font-medium">⚠ {{ flag }}</p>
                  <p class="text-slate-400 text-[12px]">As of {{ formatDate(today) }}</p>
                </td>
              </tr>
            </template>
            <tr v-if="!visiblePriorities.length">
              <td colspan="5" class="p-4 text-center text-slate-400">
                No customer priorities in this view.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    </template>
    <InvoiceDetailDrawer
      :invoice="selectedInvoice"
      :open="drawerOpen"
      :seller-name="currentUser.name"
      :seller-role="currentUser.role"
      @close="drawerOpen = false"
    />
  </div>
</template>
