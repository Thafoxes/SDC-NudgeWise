<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Eye, Pencil, Trash2 } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
import CustomerIntake from '@/components/CustomerIntake.vue';
import PurchaseOrderForm from '@/components/PurchaseOrderForm.vue';
import OrderWorkspace from '@/components/OrderWorkspace.vue';
import type { PurchaseOrderDetails, PurchaseOrder } from '@/types';
import { purchaseOrderTotal } from '@/lib/purchaseOrder';
import { computeInvoiceWithCustomer } from '@/lib/store';
import type { CustomerExtraction } from '@/lib/customerOrders';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID } from '@/lib/store';
import { getOrderEligibility } from '@/lib/customerOrders';
import {hasCurrentFinalReceipt} from '@/lib/settlement';
import { deriveOrderBlockers } from '@/lib/orderWorkflow';
import { orderStages, stageSummary, hasBuyerPo, nextStage, matchesOrderNextStep, STAGE_KEYS, STAGE_NAMES } from '@/presentation/orderStages';
import type { StageState } from '@/presentation/orderStages';
import { approvePurchaseOrder, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, attachOrderEvidence } from '@/services/commands';
import type { ChatOrderUpload } from '@/services/commands';
import { formatMYR } from '@/lib/format';

const { data, refreshStore } = useDemoStore();
const actor = computed(() => data.value.users.find(user => user.id === DEMO_SELLER_ID)!);
const customerId = ref<string | null>(null);
const customer = computed(() => data.value.customers.find(item => item.id === customerId.value));
const eligibility = computed(() => {
  void data.value;
  return customerId.value ? getOrderEligibility(customerId.value, DEMO_BUSINESS_ID) : null;
});
const orders = computed(() => data.value.purchaseOrders.filter(order => order.business_id === DEMO_BUSINESS_ID));
const query=ref(''),nextStepFilter=ref('all');
const nextStepOptions=[{value:'all',label:'All next steps'},{value:'blocked',label:'Blocked / needs review'},...STAGE_KEYS.map(key=>({value:key,label:STAGE_NAMES[key]})),{value:'completed',label:'Completed'}];
const filteredOrders=computed(()=>orders.value.filter(o=>[o.reference, customerName(o.customer_id)].some(t=>t.toLowerCase().includes(query.value.toLowerCase()))));
const customerSearch = ref('');
const availableCustomers=computed(()=>data.value.customers.filter(c=>c.business_id===DEMO_BUSINESS_ID && [c.name, c.phone, c.email || '', c.address || ''].some(value=>(value || '').toLowerCase().includes(customerSearch.value.trim().toLowerCase()))));
const screenshot=ref<ChatOrderUpload|null>(null);
const suggestion = ref<CustomerExtraction>();
const formDirty = ref(false);
const savedRevision = ref(0);
const intakeKey = ref(0);
const reason = ref('');
const activeOrderId = ref('');
const activeOrder = computed(() => orders.value.find(order => order.id === activeOrderId.value));
const calculatedTotal = computed(() => activeOrder.value?.details ? purchaseOrderTotal(activeOrder.value.details.items) : null);
const totalMismatch = computed(() => {
  const details = activeOrder.value?.details;
  return !!details?.items.length && details.document_total !== null
    && (calculatedTotal.value === null || Math.round(calculatedTotal.value * 100) !== Math.round(details.document_total * 100));
});
const needsOverride = computed(() => totalMismatch.value || eligibility.value?.allowed === false);
const busy = ref(false);
const showEditor = ref(false);
const editorMode = ref<'create' | 'upload'>('create');
function startOrder(mode: 'create' | 'upload') {
  selectCustomer(null);
  customerSearch.value = '';
  intakeKey.value += 1;
  savedRevision.value += 1;
  suggestion.value = undefined; screenshot.value = null;
  editorMode.value = mode;
  showEditor.value = true;
}
function closeEditor() { showEditor.value = false; selectCustomer(null); screenshot.value=null; }

const error = ref('');
const notice = ref('');
const route = useRoute();
const router = useRouter();
const recordId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const recordPage = computed(() => !!recordId.value);
const recordMode = computed(() => route.params.mode === 'edit' ? 'edit' : 'view');
watch([recordId, recordMode, orders], () => { if(recordId.value && orders.value.some(o => o.id === recordId.value)) openOrder(recordId.value); }, { immediate: true });

watch(() => route.query.customer, id => {
  if (typeof id === 'string' && data.value.customers.some(item => item.id === id && item.business_id === DEMO_BUSINESS_ID)) selectCustomer(id);
}, { immediate: true });

function selectCustomer(id: string | null) {
  customerId.value = id;
  activeOrderId.value = '';
  reason.value = '';
  error.value = '';
  notice.value = '';
}

function openOrder(id: string) {
  const order = orders.value.find(item => item.id === id);
  if (!order) return;
  intakeKey.value += 1;
  selectCustomer(order.customer_id);
  activeOrderId.value = id;
  editorMode.value = 'create';
  showEditor.value = true;
}

async function saveDraft(reference: string, details: PurchaseOrderDetails) {
  if (!customerId.value || busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = activeOrderId.value
      ? await updatePurchaseOrder(activeOrderId.value, reference, details, actor.value.name, actor.value.role, DEMO_BUSINESS_ID)
      : await createPurchaseOrder(customerId.value, reference, actor.value.name, actor.value.role, DEMO_BUSINESS_ID, details, editorMode.value === 'upload' ? 'uploaded_po' : screenshot.value ? 'chat_screenshot' : 'manual');
    if (!result.success || !result.id) throw new Error(result.error || 'Could not save order.');
    activeOrderId.value = result.id;
    const attached = screenshot.value;
    const evidenceId = details.evidence_id;
    if (evidenceId) {
      await attachOrderEvidence(result.id, {id: evidenceId,
        filename: attached?.evidence.filename || (editorMode.value === 'upload' ? `Existing-PO-${reference}` : `Order-evidence-${reference}`),
        mime_type: attached?.evidence.content_type || 'application/pdf',
        kind: attached ? 'chat_screenshot' : editorMode.value === 'upload' ? 'existing_po' : 'other',
        extracted_text: attached?.extracted_text }, actor.value.name,actor.value.role,DEMO_BUSINESS_ID);
    }
    screenshot.value = null;
    refreshStore();
    savedRevision.value += 1;
    notice.value = 'Order details saved. Review eligibility before approval.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not save order.';
  } finally { busy.value = false; }
}

async function approve() {
  if (!activeOrder.value || busy.value) return;
  if (formDirty.value) { error.value = 'Save the edited order details before approval.'; return; }
  if (needsOverride.value) {
    if (!reason.value.trim()) { error.value = 'Enter a reason for this seller override.'; return; }
    const totals = totalMismatch.value ? `Calculated items: ${calculatedTotal.value ?? 'Unpriced'}. Printed total: ${activeOrder.value.details!.document_total}.\n` : '';
    if (!window.confirm(`Approve order ${activeOrder.value.reference} with a seller override?\n${totals}Reason: ${reason.value.trim()}\nThis records an exception for this order only. Original amounts and existing invoice holds remain unchanged.`)) return;
  }
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await approvePurchaseOrder(activeOrder.value.id, actor.value.name, actor.value.role, DEMO_BUSINESS_ID, reason.value.trim() || undefined);
    if (!result.success) throw new Error(result.error || 'Could not approve order.');
    refreshStore();
    reason.value = '';
    notice.value = 'Order approved. Previous invoices and disputes remain unchanged.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not approve order.';
  } finally { busy.value = false; }
}

async function removeOrder(order: PurchaseOrder) {
  if (busy.value || !window.confirm(`Delete draft order ${order.reference}? This cannot be undone.`)) return;
  busy.value=true; error.value=''; notice.value='';
  try {const result=await deletePurchaseOrder(order.id,actor.value.name,actor.value.role,DEMO_BUSINESS_ID);
    if(!result.success)throw new Error(result.error||'Could not delete order');
    if(activeOrderId.value===order.id)closeEditor(); if(recordPage.value) await router.push('/orders'); refreshStore();notice.value=`Order ${order.reference} deleted.`;
  }catch(e){error.value=e instanceof Error?e.message:'Could not delete order';}finally{busy.value=false;}
}
function orderProgress(order: PurchaseOrder) {
  const d=data.value; const inv=d.invoices.find(x=>x.purchase_order_id===order.id);
  const evidence=d.orderEvidence.filter(e=>e.purchase_order_id===order.id);
  const stages=orderStages({order,quotation:d.quotations.find(q=>q.purchase_order_id===order.id),evidence,
    deliveries:d.deliveryConfirmations.filter(c=>c.purchase_order_id===order.id),
    creditNotes:(d.creditNotes||[]).filter(n=>n.purchase_order_id===order.id),
    invoice:inv?computeInvoiceWithCustomer(inv,d,d.demoState.simulated_date):null,
    receiptCount:d.settlementReceipts.filter(r=>r.purchase_order_id===order.id).length,finalReceiptIssued:!!inv&&hasCurrentFinalReceipt(inv,d),completionConfirmed:!!order.completed_at&&order.completion_key===inv?.final_receipt?.financial_key,
    criticalBlockers:deriveOrderBlockers(order.id).filter(b=>b.critical).length,money:formatMYR});
  return { next:nextStage(stages), summary: stageSummary(stages), buyerPo: hasBuyerPo({order,evidence}) };
}
const progressRows=computed(()=>filteredOrders.value.map(order=>({order,...orderProgress(order)})));
const rows=computed(()=>progressRows.value.filter(row=>matchesOrderNextStep(row.next,nextStepFilter.value)));
function nextStepCount(filter:string){return progressRows.value.filter(row=>matchesOrderNextStep(row.next,filter)).length;}
function clearFilters(){query.value='';nextStepFilter.value='all';}
const stageChip:Record<StageState,string>={done:'bg-emerald-50 text-emerald-700',current:'bg-blue-50 text-blue-700',
  blocked:'bg-rose-50 text-rose-700',todo:'bg-slate-100 text-slate-600',skipped:'bg-slate-100 text-slate-600'};
function orderAmount(order:PurchaseOrder) {
  const q=data.value.quotations.find(x=>x.purchase_order_id===order.id);
  return q?.amount??purchaseOrderTotal(order.details?.items||[]);
}
function customerName(id: string) {
  return data.value.customers.find(item => item.id === id)?.name ?? 'Customer unavailable';
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="recordPage" class="flex items-center justify-between"><button class="outline-btn" @click="router.push('/orders')">← Back to orders</button><div class="flex gap-2" v-if="activeOrder"><button v-if="recordMode==='view'" class="primary-btn" @click="router.push(`/orders/${encodeURIComponent(recordId)}/edit`)">Edit order</button><button v-else class="outline-btn" @click="router.push(`/orders/${encodeURIComponent(recordId)}/view`)">View Details</button></div></div>
    <p v-if="recordPage && !activeOrder" class="card p-4 text-rose-700">Order not found.</p>
    <div v-if="!recordPage" class="flex flex-wrap justify-between items-center gap-3"><p class="text-sm text-slate-600">Start a new order from a chat or by hand, or start from a PO the buyer already sent. The seller confirms every step.</p><div class="flex gap-2"><button type="button" class="primary-btn" :disabled="busy" @click="startOrder('create')">+ New order</button><button type="button" class="outline-btn" :disabled="busy" @click="startOrder('upload')">Start from buyer's PO</button></div></div>
    <p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p><p v-if="notice" role="status" class="text-sm text-emerald-700">{{notice}}</p>
    <section v-if="!recordPage" class="card overflow-hidden" aria-label="Order list"><div class="px-4 py-3 border-b border-slate-100 flex flex-wrap justify-between gap-2"><h2 class="font-semibold">Orders <span class="text-xs font-normal text-slate-500">{{rows.length}} of {{orders.length}}</span></h2><label class="text-xs text-slate-600">Next step<select v-model="nextStepFilter" aria-label="Filter orders by next step" class="form-input !mt-0"><option v-for="option in nextStepOptions" :key="option.value" :value="option.value">{{option.label}} ({{nextStepCount(option.value)}})</option></select></label><input v-model="query" aria-label="Search orders" placeholder="Search order, PO or customer..." class="form-input !mt-0 max-w-xs" /></div><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-50 text-left text-slate-600"><tr><th class="p-3">Reference</th><th class="p-3">Customer</th><th class="p-3">Date</th><th class="p-3">Amount</th><th class="p-3">Buyer PO</th><th class="p-3">Next step</th><th class="p-3">Approval</th><th class="p-3">Action</th></tr></thead><tbody><tr v-for="{order,summary,buyerPo} in rows" :key="order.id" class="border-t"><td class="p-3 font-medium">{{ order.reference }}</td><td class="p-3">{{ customerName(order.customer_id) }}</td><td class="p-3">{{order.created_at.slice(0,10)}}</td><td class="p-3">{{orderAmount(order)===null?'To be priced':formatMYR(orderAmount(order)!)}}</td><td class="p-3">{{ buyerPo ? 'On file' : '—' }}</td><td class="p-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap" :class="stageChip[summary.state]">{{ summary.label }}</span></td><td class="p-3 capitalize">{{ order.status }}</td><td class="p-3"><div class="flex items-center gap-2"><button type="button" class="rounded p-1.5 text-slate-700 hover:bg-slate-100" :aria-label="`View order ${order.reference}`" title="View order" @click="router.push(`/orders/${encodeURIComponent(order.id)}/view`)"><Eye class="h-4 w-4" /></button><button type="button" class="rounded p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50" :disabled="busy" :aria-label="`Edit order ${order.reference}`" title="Edit order" @click="router.push(`/orders/${encodeURIComponent(order.id)}/edit`)"><Pencil class="h-4 w-4" /></button><button type="button" class="rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40" :disabled="busy" :aria-label="`Delete order ${order.reference}`" title="Delete draft order" @click="removeOrder(order)"><Trash2 class="h-4 w-4" /></button></div></td></tr><tr v-if="!rows.length"><td colspan="8" class="p-4 text-slate-500"><template v-if="orders.length">No orders match your search and next-step filter. <button type="button" class="text-blue-700 underline" @click="clearFilters">Clear filters</button></template><template v-else>No orders yet. Start a new order, or start from a buyer's PO.</template></td></tr></tbody></table></div></section>
    <div v-if="showEditor && (!recordPage || activeOrder)" class="space-y-5"><div class="flex justify-between items-center"><h2 class="text-lg font-semibold">{{ activeOrder ? 'Order — ' + activeOrder.reference : editorMode === 'upload' ? 'Start from buyer\'s PO' : 'New order' }}</h2><button type="button" class="outline-btn" @click="recordPage ? router.push('/orders') : closeEditor()">Close</button></div>
    <p v-if="editorMode === 'upload' && !activeOrder" class="text-sm text-blue-800 bg-blue-50 rounded p-3">Upload the buyer's PO to read its items and terms. You confirm the details; NudgeWise keeps the original and does not create a replacement PO.</p>
    <section class="card p-4 space-y-3" v-if="!activeOrder"><label class="text-sm font-semibold">Select existing customer <span class="text-rose-700">*</span></label>
      <input v-model="customerSearch" class="form-input !mt-0" type="search" placeholder="Search by customer name, company, phone, or email" aria-label="Search existing customers" />
      <select class="form-input !mt-0" :value="customerId || ''" @change="selectCustomer(($event.target as HTMLSelectElement).value||null)">
       <option value="">Choose a customer...</option><option v-for="c in availableCustomers" :key="c.id" :value="c.id">{{c.name}} · {{c.phone}} · {{c.email || 'No email' }}</option>
      </select><p v-if="!availableCustomers.length" class="text-xs text-slate-500">No matching customers. Try another name or add a new customer.</p><details><summary class="text-blue-700 cursor-pointer text-sm">+ Add a customer or search more options</summary>
      <CustomerIntake :key="intakeKey" :suggestion="suggestion" @selected="selectCustomer" /></details>
    </section>
    <section v-if="customer && eligibility" id="stage-order" class="scroll-mt-48 lg:scroll-mt-28 card p-4 sm:p-5 space-y-4" aria-label="Order eligibility">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h2 class="text-base font-semibold text-slate-900">{{ customer.name }}</h2><p class="mt-1 text-sm text-slate-600">{{ customer.phone }} · {{ customer.email || 'No billing email' }}</p></div>
        <span class="rounded px-2.5 py-1 text-xs font-medium" :class="eligibility.allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'">{{ eligibility.allowed ? 'Eligible for a new order' : 'Order hold' }}</span>
      </div>
      <div v-if="!eligibility.allowed" class="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <p class="text-sm font-semibold text-amber-900">Previous disputed invoices require attention</p>
        <p class="text-sm text-amber-900">Resolve the dispute and settle the required balance, or obtain a seller override for this order.</p>
        <ul class="space-y-2 text-sm text-amber-900">
          <li v-for="blocker in eligibility.blockers" :key="blocker.invoice_id"><strong>{{ blocker.invoice_number }}</strong> · {{ formatMYR(blocker.balance) }} outstanding<br />{{ blocker.reason }}</li>
        </ul>
      </div>
      <div v-if="activeOrder" class="border-t border-slate-100 pt-4 space-y-3">
        <p class="text-sm text-slate-700"><strong>{{ activeOrder.reference }}</strong> · {{ activeOrder.status === 'approved' ? 'Approved' : 'Draft — awaiting approval' }}</p>
        <form v-if="activeOrder.status === 'draft' && (!recordPage || recordMode === 'edit')" class="space-y-3" @submit.prevent="approve">
          <p v-if="totalMismatch" role="alert" class="text-sm text-amber-800">Items add up to {{ calculatedTotal === null ? 'an unknown amount (prices missing)' : calculatedTotal }} {{ activeOrder.details?.currency }}, but the buyer document total entered is {{ activeOrder.details?.document_total }} {{ activeOrder.details?.currency }}. For a direct order with no PO, open Edit order details and clear the optional document total, then save. If a real document has a different total, correct the items or record a seller exception.</p>
          <label v-if="needsOverride && actor.role === 'seller'" class="block text-sm font-medium text-slate-700">Reason for allowing this order<textarea v-model.trim="reason" required maxlength="500" rows="3" class="form-input" placeholder="Explain why this specific order can proceed despite the total difference or customer hold." :disabled="busy" /></label>
          <p v-if="actor.role !== 'seller'" class="text-sm text-amber-800">Only a seller can approve an order or override. Ask the seller to review this draft.</p>
          <p v-if="formDirty" class="text-sm text-amber-800">Save the edited order details before approval.</p>
          <button type="submit" class="primary-btn" :disabled="busy || formDirty || actor.role !== 'seller' || (needsOverride && !reason.trim())">{{ needsOverride ? 'Approve this order with override' : 'Approve order' }}</button>
        </form>
        <div v-if="activeOrder.override" class="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
          <p class="font-semibold">Seller override for this order</p>
          <p>{{ activeOrder.override.reason }}</p>
          <p v-if="activeOrder.override.total_mismatch">Reviewed total difference: calculated {{ activeOrder.override.total_mismatch.calculated ?? 'Unpriced' }}; printed {{ activeOrder.override.total_mismatch.printed }} {{ activeOrder.details?.currency }}.</p>
          <p>Approved by {{ activeOrder.override.actor }} · {{ activeOrder.override.approved_at }}</p>
          <p>This approval does not clear previous disputes or apply to future orders.</p>
        </div>
      </div>
      <p v-if="error" role="alert" class="text-sm text-rose-700">{{ error }}</p>
      <p v-if="notice" role="status" class="text-sm text-emerald-700">{{ notice }}</p>
    </section>
    <OrderWorkspace v-if="activeOrder" :key="activeOrder.id" :order="activeOrder" />
    <details v-if="activeOrder && (!recordPage || recordMode === 'edit')" class="card p-4"><summary class="font-semibold cursor-pointer">{{activeOrder.status==='approved'?'View order details':'Edit order details'}}</summary>
     <PurchaseOrderForm :order="activeOrder" :mode="editorMode" :customer="customer" :saving="busy" :saved-revision="savedRevision" @save="saveDraft" @buyer="suggestion=$event" @dirty="formDirty=$event" @screenshot="screenshot=$event" />
    </details>
    <PurchaseOrderForm v-else :mode="editorMode" :customer="customer" :saving="busy" :saved-revision="savedRevision" @save="saveDraft" @buyer="suggestion=$event" @dirty="formDirty=$event" @screenshot="screenshot=$event" />
    </div>
    <p class="text-xs text-slate-500">Seller demo: approvals are recorded under the demo seller. Individual authenticated seller accounts are required before production use.</p>
  </div>
</template>
