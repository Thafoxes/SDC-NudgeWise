<script setup lang="ts">
import {computed,ref} from 'vue';
import {useDemoStore} from '@/composables/useDemoStore';
import {computeInvoiceWithCustomer} from '@/lib/store';
import {hasCurrentFinalReceipt,settlementBlockers,orderCompletionBlockers} from '@/lib/settlement';
import {invoiceDocument} from '@/lib/invoiceDocuments';
import {viewDocumentPdf,downloadDocumentPdf} from '@/lib/documentPdf';
import {issueFinalReceipt,completeOrder} from '@/services/commands';
import EmailDocumentSend from '@/components/EmailDocumentSend.vue';
const props=defineProps<{invoiceId:string;sellerName:string;sellerRole:string}>();
const {data,refreshStore}=useDemoStore();
const invoice=computed(()=>data.value.invoices.find(i=>i.id===props.invoiceId));
const view=computed(()=>invoice.value?computeInvoiceWithCustomer(invoice.value,data.value,data.value.demoState.simulated_date):null);
const order=computed(()=>data.value.purchaseOrders.find(o=>o.id===invoice.value?.purchase_order_id));
const proof=computed(()=>data.value.orderEvidence.filter(e=>e.purchase_order_id===invoice.value?.purchase_order_id&&e.business_id===invoice.value?.business_id&&e.kind==='payment_proof'));
const receiptCurrent=computed(()=>!!invoice.value&&hasCurrentFinalReceipt(invoice.value,data.value));
const blockers=computed(()=>invoice.value?settlementBlockers(invoice.value,data.value):[]);
const completionBlockers=computed(()=>order.value?orderCompletionBlockers(order.value.id,data.value):[]);
const completed=computed(()=>!!order.value?.completed_at&&receiptCurrent.value&&order.value.completion_key===invoice.value?.final_receipt?.financial_key&&!completionBlockers.value.length);
const note=ref(''),confirmed=ref(false),busy=ref(false),error=ref(''),notice=ref('');
function pdf(kind:'invoice'|'final_receipt',download=false){
 try{const doc=invoiceDocument(data.value,props.invoiceId,kind);if(download)downloadDocumentPdf(doc.filename,doc.title,doc.sections);else viewDocumentPdf(doc.title,doc.sections);}
 catch(cause){error.value=cause instanceof Error?cause.message:'Could not create PDF';}
}
async function issue(){if(!invoice.value||!confirmed.value||busy.value)return;busy.value=true;error.value='';notice.value='';
 try{await issueFinalReceipt(invoice.value.id,note.value,props.sellerName,props.sellerRole,invoice.value.business_id);refreshStore();notice.value='Final receipt issued. View the PDF to print it.';}
 catch(cause){error.value=cause instanceof Error?cause.message:'Could not issue receipt';}finally{busy.value=false;}}
async function finish(){if(!order.value||busy.value)return;
 if(!window.confirm(`Complete order ${order.value.reference}? Confirm delivery is resolved and the invoice is settled. This does not create or change payments.`))return;
 busy.value=true;error.value='';notice.value='';
 try{await completeOrder(order.value.id,props.sellerName,props.sellerRole,order.value.business_id);refreshStore();notice.value='Order completed. Final receipt remains available for printing.';}
 catch(cause){error.value=cause instanceof Error?cause.message:'Could not complete order';}finally{busy.value=false;}}
</script>
<template>
 <section v-if="invoice&&view" class="rounded-lg border border-slate-200 p-4 space-y-3" aria-label="Invoice documents and completion">
  <h4 class="text-sm font-semibold">Invoice documents and final receipt</h4>
  <div class="flex flex-wrap gap-2"><button type="button" class="outline-btn" @click="pdf('invoice')">View / print invoice PDF</button><button type="button" class="outline-btn" @click="pdf('invoice',true)">Download invoice PDF</button></div>
  <div v-if="proof.length" class="space-y-1"><p class="text-xs font-semibold text-slate-600">Payment attachments (supporting evidence only)</p><a v-for="file in proof" :key="file.id" :href="`/api/po-evidence/${file.id}`" target="_blank" rel="noopener" class="block text-sm text-blue-700 underline">View {{file.filename}}</a></div>
  <div v-if="invoice.final_receipt" class="space-y-2"><p class="text-xs text-slate-600">{{invoice.final_receipt.number}} · {{receiptCurrent?'Current settlement':'Previous settlement — balance changed'}}</p><div class="flex flex-wrap gap-2"><button type="button" class="outline-btn" @click="pdf('final_receipt')">View / print final receipt</button><button type="button" class="outline-btn" @click="pdf('final_receipt',true)">Download final receipt</button></div></div>
  <EmailDocumentSend kind="invoice" :record-id="invoice.id" />
  <EmailDocumentSend v-if="invoice.final_receipt" kind="receipt" :record-id="invoice.id" />
  <template v-if="!receiptCurrent">
   <p v-if="view.outstanding_balance>0" class="text-sm text-slate-600">Record verified payments for the remaining balance first. Unverified screenshots or claims do not issue a final receipt.</p>
   <ul v-else-if="blockers.length" class="list-disc pl-5 text-sm text-amber-800"><li v-for="reason in blockers" :key="reason">{{reason}}</li></ul>
   <div v-else class="space-y-3"><p class="text-sm text-slate-600">The recorded balance is zero. Confirm the settlement before issuing its final receipt; this step does not record another payment.</p>
    <label class="block text-sm font-medium">Verification source / settlement note (required)<input v-model.trim="note" maxlength="1000" class="form-input" placeholder="e.g. Checked bank statement / counted cash; date and reference" /></label>
    <label class="flex gap-2 items-start text-sm"><input v-model="confirmed" type="checkbox" class="mt-1" /><span>I checked the funds received and any credit adjustments. An uploaded transfer screenshot alone is not verification.</span></label>
    <button type="button" class="primary-btn" :disabled="busy||!confirmed||!note||sellerRole!=='seller'" @click="issue">{{busy?'Saving…':'Confirm settlement and issue final receipt'}}</button>
   </div>
  </template>
  <template v-if="order&&receiptCurrent">
   <p v-if="completed" role="status" class="text-sm font-medium text-emerald-700">Order completed · {{order.completed_at?.slice(0,10)}} · {{order.completed_by}}</p>
   <template v-else><p class="text-sm text-slate-600">Final receipt issued. Complete the order once delivery and all review issues are resolved.</p>
    <ul v-if="completionBlockers.length" class="list-disc pl-5 text-sm text-amber-800"><li v-for="reason in completionBlockers" :key="reason">{{reason}}</li></ul>
    <a v-if="completionBlockers.length" :href="`#/orders/${order.id}/view`" class="text-sm text-blue-700 underline">Open order to resolve remaining steps</a>
    <button type="button" class="primary-btn" :disabled="busy||!!completionBlockers.length||sellerRole!=='seller'" @click="finish">Complete order</button>
   </template>
  </template>
  <p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p><p v-if="notice" role="status" class="text-sm text-emerald-700">{{notice}}</p>
 </section>
</template>
