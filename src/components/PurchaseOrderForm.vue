<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { Customer, PurchaseOrder, PurchaseOrderDetails } from '@/types';
import type { CustomerExtraction } from '@/lib/customerOrders';
import { emptyPurchaseOrderDetails, purchaseOrderLineTotal, purchaseOrderTotal, validatePurchaseOrderDetails } from '@/lib/purchaseOrder';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID } from '@/lib/store';
import { backendEnabled, extractPurchaseOrderDocument, extractChatOrder } from '@/services/commands';
import type { ChatOrderUpload } from '@/services/commands';

const props = defineProps<{ order?: PurchaseOrder; customer?: Customer; saving: boolean; savedRevision: number; mode?: 'create' | 'upload' }>();
const emit = defineEmits<{ save: [reference: string, details: PurchaseOrderDetails]; buyer: [suggestion: CustomerExtraction]; dirty: [value: boolean]; screenshot: [result: ChatOrderUpload] }>();
const {data}=useDemoStore();
const company=computed(()=>data.value.businesses.find(b=>b.id===DEMO_BUSINESS_ID));
const details = reactive(emptyPurchaseOrderDetails());
const reference = ref('');
const reviewed = ref(false);
const uploading = ref(false);
const chatWarnings = ref<string[]>([]);
const error = ref('');
const notice = ref('');
const originalName = ref('');
const originalType = ref('');
const baseline = ref('');
let documentRevision = 0;
const locked = computed(() => props.order?.status === 'approved');
const disabled = computed(() => locked.value || uploading.value || props.saving);
const evidenceUrl = computed(() => details.evidence_id ? `/api/po-evidence/${details.evidence_id}` : '');
const total = computed(() => purchaseOrderTotal(details.items));
const mismatch = computed(() => details.items.length > 0 && total.value !== null && typeof details.document_total === 'number'
  && Math.round(total.value * 100) !== Math.round(Number(details.document_total) * 100));
const serialized = () => JSON.stringify({ reference: reference.value, details });
const dirty = computed(() => serialized() !== baseline.value);
watch(dirty, value => emit('dirty', value), { immediate: true });
watch(() => [props.order?.id, props.savedRevision, props.order?.details], () => {
  documentRevision += 1;
  uploading.value = false;
  for (const key of Object.keys(details)) delete (details as unknown as Record<string, unknown>)[key];
  Object.assign(details, emptyPurchaseOrderDetails(), structuredClone(props.order?.details || {}));
  reference.value = props.order?.reference || `DRAFT-${Date.now().toString().slice(-8)}`;
  reviewed.value = false;
  originalName.value = '';
  originalType.value = '';
  error.value = '';
  notice.value = ''; chatWarnings.value = [];
  baseline.value = serialized();
}, { immediate: true });

watch(() => props.customer?.id, () => {
  if (!props.customer || details.buyer_name) return;
  Object.assign(details, { buyer_name: props.customer.name, buyer_phone: props.customer.phone || '', buyer_email: props.customer.email || '', buyer_address: props.customer.address || '' });
});

type TextKey = Exclude<keyof PurchaseOrderDetails, 'items' | 'document_total' | 'evidence_id'>;
const groups: { title: string; fields: { key: TextKey; label: string; long?: boolean; date?: boolean }[] }[] = [
  { title: 'Order information', fields: [{ key: 'order_date', label: 'PO date', date: true }, { key: 'delivery_date', label: 'Delivery date', date: true }, { key: 'payment_terms', label: 'Payment terms' }, { key: 'document_status', label: 'Status printed on document' }] },
  { title: 'Buyer — company placing the order', fields: [{ key: 'buyer_name', label: 'Buyer name' }, { key: 'buyer_phone', label: 'Buyer phone' }, { key: 'buyer_email', label: 'Buyer email' }, { key: 'buyer_address', label: 'Buyer address', long: true }] },
  { title: 'Delivery and internal references', fields: [{ key: 'delivery_address', label: 'Delivery address', long: true }, { key: 'delivery_phone', label: 'Delivery phone' }, { key: 'attention', label: 'Attention / contact' }, { key: 'requested_by', label: 'Requested by' }, { key: 'document_approved_by', label: 'Approved by on document' }, { key: 'department', label: 'Department' }, { key: 'notes', label: 'Notes', long: true }] },
];

async function readPO(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const revision = ++documentRevision;
  uploading.value = true;
  error.value = '';
  notice.value = '';
  reviewed.value = false;
  try {
    const result = await extractPurchaseOrderDocument(file);
    if (revision !== documentRevision) return;
    reference.value = result.reference;
    Object.assign(details, emptyPurchaseOrderDetails(), result.details, { evidence_id: result.evidence.id });
    originalName.value = result.evidence.filename;
    originalType.value = result.evidence.content_type;
    notice.value = result.extraction_error || 'Original saved. Check the extracted fields, every line item, and the currency before saving.';
  } catch (cause) {
    if (revision === documentRevision) error.value = cause instanceof Error ? cause.message : 'Could not upload the PO. Please try again.';
  } finally { if (revision === documentRevision) uploading.value = false; input.value = ''; }
}

async function readChat(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; if (!file) return;
  uploading.value = true; error.value = ''; notice.value = ''; reviewed.value = false;
  const revision = ++documentRevision;
  try {
    const result = await extractChatOrder(file);
    if (revision !== documentRevision) return;
    if (result.items.length) {
      Object.assign(details, { items: result.items, currency: details.currency || 'MYR', evidence_id: result.evidence.id,
        document_total: null, ...(result.buyer_name ? { buyer_name: result.buyer_name } : {}) });
      emit('screenshot', result);
    }
    originalName.value = result.evidence.filename;
    originalType.value = result.evidence.content_type;
    chatWarnings.value = result.warnings || [];
    notice.value = result.extraction_error || (result.items.length ? 'Chat items extracted. Check names and quantities; prices remain blank.' : 'No reliable item list extracted. Enter manually.');
  } catch (e) { error.value = e instanceof Error ? e.message : 'Chat OCR failed'; }
  finally { uploading.value = false; input.value = ''; }
}

function useBuyer() {
  emit('buyer', { name: details.buyer_name || null, phone: details.buyer_phone || details.delivery_phone || null,
    email: details.buyer_email || null, address: details.buyer_address || null });
}

function save() {
  if (!reviewed.value || disabled.value || !props.customer) return;
  error.value = '';
  try {
    const value = { ...details, document_total: typeof details.document_total === 'number' ? details.document_total : null };
    emit('save', reference.value, validatePurchaseOrderDetails(value));
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Check the PO details.'; }
}

function money(value: number | null) { return value === null || !Number.isFinite(value) ? '—' : value.toFixed(2); }
</script>

<template>
  <form class="card min-w-0 p-4 sm:p-6 space-y-6" aria-label="Order details" @submit.prevent="save">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><h2 class="text-lg font-semibold">Order details</h2><p class="mt-1 text-sm text-slate-600">{{ props.mode==='upload' ? "Read the buyer's PO, then check every line before saving." : "Type the items, or read them from a chat screenshot or PDF. If the buyer already sent a PO, use Start from buyer's PO instead." }}</p></div>
      <span v-if="locked" class="rounded bg-emerald-50 px-3 py-1 text-sm text-emerald-800">Approved · read only</span>
    </div>
    <div v-if="!locked && props.mode !== 'upload'" class="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
      <label class="block text-sm font-semibold">Extract requested items from buyer chat screenshot or PDF (optional)
        <input class="mt-2 block w-full text-sm" type="file" accept="image/png,image/jpeg,application/pdf" :disabled="!backendEnabled || disabled" @change="readChat" />
      </label>
      <p class="text-xs text-slate-600">PNG, JPG or PDF · up to 10 MB and 5 pages. AI suggests requested item names and quantities only. Review every item; no buyer approval is inferred.</p>
      <p v-for="warning in chatWarnings" :key="warning" class="text-xs text-amber-800">{{ warning }}</p>
    </div>
    <div v-if="!locked && props.mode === 'upload'" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 space-y-2">
      <label class="block text-sm font-semibold">Upload PO image or PDF
        <input type="file" accept="image/png,image/jpeg,application/pdf" class="mt-2 block w-full text-sm" :disabled="!backendEnabled || disabled" @change="readPO" />
      </label>
      <p class="text-xs text-slate-600">PNG, JPG or PDF · up to 10 MB and 5 pages. The original is stored in the database as evidence; OCR suggestions need your review.</p>
      <p class="text-xs text-slate-600">OCR uses the configured Python environment. Field extraction uses the configured local or cloud AI provider.</p>
      <p v-if="!backendEnabled" class="text-sm text-amber-800">Connect the backend to upload and retain evidence. Manual PO entry is available here.</p>
      <p v-if="uploading" role="status" class="text-sm">Saving original and reading the PO… this may take a few minutes.</p>
    </div>
    <div v-if="evidenceUrl" class="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
      <a :href="evidenceUrl" target="_blank" rel="noopener" class="text-sm font-medium text-blue-800 underline">Open original PO{{ originalName ? `: ${originalName}` : ' evidence' }}</a>
      <img v-if="originalType.startsWith('image/')" :src="evidenceUrl" alt="Original purchase order for checking extracted fields" class="max-h-96 max-w-full rounded border bg-white object-contain" />
      <p class="text-xs text-blue-900">Editing the fields below does not alter the stored original.</p>
    </div>
    <p v-if="notice" role="status" class="text-sm text-blue-800">{{ notice }}</p>
    <p v-if="error" role="alert" class="text-sm text-rose-700">{{ error }}</p>
    <fieldset :disabled="disabled" class="min-w-0 space-y-6">
      <label class="block text-sm font-medium">{{props.mode==='upload'?'Buyer PO number':'Order reference'}} <span class="text-rose-700">*</span><input v-model.trim="reference" required maxlength="100" class="form-input" /></label>
      <section class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label="Our company fulfilling this order">
        <div class="flex flex-wrap justify-between items-center gap-2"><h3 class="text-sm font-semibold">Our company — supplier / seller</h3><RouterLink to="/settings" class="text-sm text-blue-700 underline">Edit company settings</RouterLink></div>
        <p class="text-xs text-slate-600">Your own company fulfils this order. These details come from Settings; no supplier entry is needed here.</p>
        <dl class="grid gap-3 text-sm sm:grid-cols-2"><div><dt class="text-slate-500">Company</dt><dd class="font-medium">{{company?.display_name||company?.name||'-'}}</dd></div><div><dt class="text-slate-500">Phone</dt><dd>{{company?.phone||'-'}}</dd></div><div><dt class="text-slate-500">Address</dt><dd class="whitespace-pre-line">{{company?.address||'-'}}</dd></div><div><dt class="text-slate-500">Email</dt><dd class="break-words">{{company?.email||'-'}}</dd></div></dl>
      </section>
      <section v-for="group in groups" :key="group.title" class="space-y-3 border-t border-slate-100 pt-4">
        <h3 class="text-sm font-semibold text-slate-900">{{ group.title }}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <label v-for="field in group.fields" :key="field.key" class="text-sm font-medium text-slate-700" :class="field.key === 'notes' ? 'sm:col-span-2' : ''">{{ field.label }}
            <textarea v-if="field.long" v-model="details[field.key]" rows="2" maxlength="2000" class="form-input" />
            <input v-else v-model="details[field.key]" :type="field.date ? 'date' : 'text'" maxlength="254" class="form-input" />
          </label>
        </div>
      </section>
      <button v-if="!locked && details.buyer_name" type="button" class="outline-btn" @click="useBuyer">Use these buyer details to find or add customer</button>
      <section class="space-y-3 border-t border-slate-100 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold">Line items</h3><button type="button" class="outline-btn" :disabled="details.items.length >= 100" @click="details.items.push({ name: '', code: '', quantity: 1, unit_price: null, discount: 0 })">Add item</button></div>
        <p class="text-xs text-slate-600">Discount is an amount for the whole line. Repeated items remain separate. Missing OCR numbers must be completed.</p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[740px] text-sm text-left">
            <thead><tr class="border-b text-slate-600"><th class="p-2">Description</th><th class="p-2">Item code</th><th class="p-2">Qty</th><th class="p-2">Unit price</th><th class="p-2">Discount</th><th class="p-2">Line total</th><th class="p-2">Actions</th></tr></thead>
            <tbody><tr v-for="(item, index) in details.items" :key="index" class="border-b border-slate-100">
              <td class="p-1"><input v-model="item.name" :aria-label="`Item ${index + 1} description`" required maxlength="240" class="form-input min-w-48" /></td>
              <td class="p-1"><input v-model="item.code" :aria-label="`Item ${index + 1} code`" maxlength="100" class="form-input w-32" /></td>
              <td class="p-1"><input v-model.number="item.quantity" :aria-label="`Item ${index + 1} quantity`" type="number" min="0.001" step="0.001" required class="form-input w-24" /></td>
              <td class="p-1"><input v-model.number="item.unit_price" :aria-label="`Item ${index + 1} unit price`" type="number" min="0" step="0.01" class="form-input w-28" placeholder="TBC" /></td>
              <td class="p-1"><input v-model.number="item.discount" :aria-label="`Item ${index + 1} discount`" type="number" min="0" step="0.01" required class="form-input w-24" /></td>
              <td class="p-2 tabular-nums">{{ money(purchaseOrderLineTotal(item)) }}</td>
              <td class="p-1"><button type="button" class="text-rose-700 underline" :aria-label="`Remove item ${index + 1}`" @click="details.items.splice(index, 1)">Remove</button></td>
            </tr></tbody>
          </table>
          <p v-if="!details.items.length" class="py-4 text-sm text-slate-500">No items yet. Upload a PO or add a row.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-sm font-medium">Currency<input v-model.trim="details.currency" class="form-input uppercase" maxlength="3" placeholder="Confirm, e.g. MYR or USD" @input="details.currency = details.currency.toUpperCase()" /></label>
          <label class="text-sm font-medium">Total printed on buyer’s document (optional)<input v-model.number="details.document_total" type="number" min="0" step="0.01" class="form-input" /></label>
          <p class="self-end py-2 text-sm">Calculated total <strong class="block text-lg tabular-nums">{{ details.currency || 'Currency unconfirmed' }} {{ money(total) }}</strong></p>
        </div>
        <p class="text-xs text-slate-600">This is the total shown on an actual buyer PO, not an item count or the quotation total. For a direct order with no PO, leave it blank.</p>
        <button v-if="details.document_total !== null && !locked" type="button" class="outline-btn" @click="details.document_total=null">No document total — clear this field</button>
        <p v-if="mismatch" role="alert" class="text-sm text-amber-800">The line items and printed total differ. Save the draft, then correct the difference or record a seller override reason and confirm approval.</p>
      </section>
      <label v-if="!locked" class="flex items-start gap-2 text-sm"><input v-model="reviewed" type="checkbox" required class="mt-1" /><span>I reviewed the item details and any uploaded original; unpriced items will be priced at quotation.</span></label>
      <p class="text-xs text-slate-600">The document's status and approval names are source information. They do not approve this order in NudgeWise.</p>
      <p v-if="!props.customer && !locked" class="text-sm text-amber-800">Find or add the buyer above before saving this order.</p>
      <button v-if="!locked" type="submit" class="primary-btn" :disabled="!reviewed || !props.customer">{{ props.order ? 'Save order changes' : 'Save draft order' }}</button>
    </fieldset>
  </form>
</template>
