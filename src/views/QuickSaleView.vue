<script setup lang="ts">
import {computed,reactive,ref,watch} from 'vue';
import {RouterLink,useRouter} from 'vue-router';
import CustomerIntake from '@/components/CustomerIntake.vue';
import {useDemoStore} from '@/composables/useDemoStore';
import {DEMO_BUSINESS_ID,DEMO_SELLER_ID} from '@/lib/store';
import {getOrderEligibility} from '@/lib/customerOrders';
import {purchaseOrderTotal} from '@/lib/purchaseOrder';
import {createQuickSale,backendEnabled,extractQuickSaleDocument,uploadPaymentEvidence} from '@/services/commands';
import type {QuickSaleInput} from '@/lib/quickSale';
const {data}=useDemoStore();const router=useRouter();
const seller=computed(()=>data.value.users.find(u=>u.id===DEMO_SELLER_ID)!);
const business=computed(()=>data.value.businesses.find(b=>b.id===DEMO_BUSINESS_ID));
const customerId=ref<string|null>(null);const busy=ref(false),error=ref('');
const form=reactive<QuickSaleInput>({customer_id:'',reference:`INV-${Date.now().toString(36).toUpperCase()}`,issue_date:data.value.demoState.simulated_date,due_date:'',
 items:[{name:'',code:'',quantity:1,unit_price:null,discount:0}],payment_mode:'paid_now',handed_over:false,funds_confirmed:false,
 method:'cash',payment_reference:'',verification_note:'',override_reason:''});
const uploading=ref(false),uploadError=ref(''),uploadNotice=ref(''),extractionWarnings=ref<string[]>([]),suggestedBuyer=ref('');
watch(()=>form.items,()=>{form.extraction_reviewed=false;form.funds_confirmed=false;},{deep:true});
watch(()=>[form.payment_mode,form.method,form.payment_reference],()=>{form.funds_confirmed=false;});
async function readOrder(event:Event){
 const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file||uploading.value)return;
 if(form.items.some(i=>i.name.trim()||i.unit_price!==null)&&!window.confirm('Replace the item rows with the document extraction? Review the proposals before issuing an invoice.')){input.value='';return;}
 uploading.value=true;uploadError.value='';uploadNotice.value='';form.funds_confirmed=false;form.extraction_reviewed=false;
 try{const result=await extractQuickSaleDocument(file,seller.value.role);
  form.order_evidence={id:result.evidence.id,filename:result.evidence.filename,mime_type:result.evidence.content_type};
  if(result.items.length)form.items=result.items;
  suggestedBuyer.value=result.buyer_name;extractionWarnings.value=result.warnings;
  uploadNotice.value=result.extraction_error||(result.items.length?'Order read. Review the items, quantities, prices and company currency. Missing prices must be entered manually.':'No reliable requested items found. The original is retained; enter the items manually.');
  if(result.extraction_error)console.error('Quick sale document extraction failed:',result.extraction_error);
 }catch(cause){uploadError.value=cause instanceof Error?cause.message:'Could not read order';console.error('Quick sale document extraction failed:',cause);}
 finally{uploading.value=false;input.value='';}
}
async function readPaymentProof(event:Event){
 const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file||uploading.value)return;
 uploading.value=true;uploadError.value='';form.funds_confirmed=false;
 try{const result=await uploadPaymentEvidence(file,seller.value.role);form.payment_evidence={id:result.evidence.id,filename:result.evidence.filename,mime_type:result.evidence.content_type};}
 catch(cause){uploadError.value=cause instanceof Error?cause.message:'Could not attach payment proof';}
 finally{uploading.value=false;input.value='';}
}
const total=computed(()=>purchaseOrderTotal(form.items));
const eligibility=computed(()=>{void data.value;return customerId.value?getOrderEligibility(customerId.value,DEMO_BUSINESS_ID):null;});
async function save(){if(busy.value||uploading.value||!customerId.value)return;busy.value=true;error.value='';
 try{const result=await createQuickSale({...form,items:form.items.map(i=>({...i})),customer_id:customerId.value},seller.value.name,seller.value.role,DEMO_BUSINESS_ID);
  await router.push({path:'/invoices',query:{invoice:result.id}});
 }catch(cause){error.value=cause instanceof Error?cause.message:'Could not create invoice';}finally{busy.value=false;}}
</script>
<template>
 <div class="mx-auto max-w-5xl space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-semibold">Quick sale / direct invoice</h2><p class="mt-1 text-sm text-slate-600">For small B2B sales with agreed prices. No quotation or buyer PO is required.</p></div><RouterLink class="outline-btn" to="/invoices">Back to invoices</RouterLink></div>
  <CustomerIntake @selected="customerId=$event" />
  <form class="card p-4 sm:p-6 space-y-5" @submit.prevent="save">
   <fieldset :disabled="busy||uploading" class="space-y-5">
    <p class="text-sm text-slate-600">Seller: <strong>{{business?.display_name||business?.name}}</strong> · {{business?.currency}} · Prepared by {{business?.salesperson_name||seller.name}}</p>
    <div class="grid gap-3 sm:grid-cols-3"><label class="text-sm font-medium">Invoice reference<input v-model.trim="form.reference" required maxlength="80" class="form-input" /></label><label class="text-sm font-medium">Issue date<input v-model="form.issue_date" type="date" required :max="data.demoState.simulated_date" class="form-input" /></label><label class="text-sm font-medium">Payment timing<select v-model="form.payment_mode" class="form-input"><option value="paid_now">Paid immediately</option><option value="pay_later">Pay later / credit sale</option></select></label></div>
    <div v-if="form.payment_mode==='pay_later'"><label class="block text-sm font-medium">Agreed due date<input v-model="form.due_date" type="date" required :min="form.issue_date" class="form-input sm:max-w-xs" /></label></div>
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2" aria-label="Extract quick-sale order details">
     <label class="block text-sm font-semibold">Read order screenshot or PDF (optional)<input type="file" accept="image/png,image/jpeg,application/pdf" class="mt-2 block w-full text-sm" :disabled="!backendEnabled" @change="readOrder" /></label>
     <p class="text-xs text-slate-600">Docling reads the document; AI proposes requested items, quantities and any explicit prices. PNG, JPG or PDF · up to 10 MB / five pages. You still choose the customer and review every value.</p>
     <p v-if="!backendEnabled" class="text-xs text-amber-800">Connect the backend to extract documents and retain originals.</p>
     <p v-if="suggestedBuyer" class="text-sm">Buyer mentioned in document: {{suggestedBuyer}}. Confirm the selected customer above.</p>
     <p v-if="uploadNotice" role="status" class="text-sm text-slate-700">{{uploadNotice}}</p><p v-for="warning in extractionWarnings" :key="warning" class="text-xs text-amber-800">{{warning}}</p>
     <div v-if="form.order_evidence" class="flex flex-wrap items-center gap-2 text-sm"><a :href="`/api/po-evidence/${form.order_evidence.id}`" target="_blank" rel="noopener" class="text-blue-700 underline">View original: {{form.order_evidence.filename}}</a><button type="button" class="text-xs underline" @click="form.order_evidence=undefined;form.extraction_reviewed=false">Remove attachment</button></div>
    </section>
    <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr><th class="p-2">Item</th><th class="p-2">Quantity</th><th class="p-2">Unit price</th><th class="p-2">Line discount</th><th class="p-2"><span class="sr-only">Remove</span></th></tr></thead><tbody><tr v-for="(item,index) in form.items" :key="index"><td class="p-1"><input v-model.trim="item.name" required maxlength="240" class="form-input min-w-48" :aria-label="`Item ${index+1} description`" /></td><td class="p-1"><input v-model.number="item.quantity" type="number" required min="0.001" step="0.001" class="form-input w-24" :aria-label="`Item ${index+1} quantity`" /></td><td class="p-1"><input v-model.number="item.unit_price" type="number" required min="0" step="0.01" class="form-input w-28" :aria-label="`Item ${index+1} unit price`" /></td><td class="p-1"><input v-model.number="item.discount" type="number" required min="0" step="0.01" class="form-input w-28" :aria-label="`Item ${index+1} line discount amount`" /></td><td class="p-1"><button type="button" class="outline-btn" :disabled="form.items.length===1" @click="form.items.splice(index,1)">Remove</button></td></tr></tbody></table></div>
    <div class="flex justify-between items-center gap-3"><button type="button" class="outline-btn" :disabled="form.items.length>=100" @click="form.items.push({name:'',code:'',quantity:1,unit_price:null,discount:0})">Add item</button><strong>Total: {{business?.currency}} {{total===null?'-':total.toFixed(2)}}</strong></div>
    <label v-if="form.order_evidence" class="flex items-start gap-2 text-sm"><input v-model="form.extraction_reviewed" type="checkbox" required class="mt-1" /><span>I checked extracted descriptions, quantities, prices, line discounts and {{business?.currency}} currency against the original. Unknown fees or taxes are not automatically included.</span></label>
    <label class="flex items-start gap-2 text-sm"><input v-model="form.handed_over" type="checkbox" class="mt-1" :required="form.payment_mode==='paid_now'" /><span>I confirm all listed goods have been handed over and accepted by the customer. <span v-if="form.payment_mode==='pay_later'">Leave unchecked if delivery is still pending.</span></span></label>
    <div v-if="form.payment_mode==='paid_now'" class="rounded-lg border bg-slate-50 p-4 space-y-3">
     <div class="grid gap-3 sm:grid-cols-2"><label class="text-sm font-medium">Payment method<select v-model="form.method" class="form-input"><option value="cash">Cash</option><option value="duitnow">DuitNow</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cheque">Cleared cheque</option></select></label><label class="text-sm font-medium">Payment reference (optional)<input v-model.trim="form.payment_reference" maxlength="100" class="form-input" /></label></div>
     <div class="space-y-2"><label class="block text-sm font-medium">Bank transfer / card receipt attachment (optional)<input type="file" accept="image/png,image/jpeg,application/pdf" class="mt-2 block w-full text-sm" :disabled="!backendEnabled" @change="readPaymentProof" /></label><p class="text-xs text-slate-600">Image or PDF up to 10 MB. Stored as supporting evidence without OCR or cloud AI; it does not verify the payment.</p></div>
     <label class="block text-sm font-medium">Verification source (required)<input v-model.trim="form.verification_note" required maxlength="1000" class="form-input" placeholder="e.g. Cash counted / checked settled credit in bank records" /></label>
     <label class="flex items-start gap-2 text-sm"><input v-model="form.funds_confirmed" type="checkbox" required class="mt-1" /><span>I received and counted the cash, or independently verified the settled payment. A transfer screenshot or pending transaction is not enough.</span></label>
     <p class="text-xs text-slate-600">This records the full payment, issues the final receipt, and completes the sale. View and print the PDFs from Invoice Details.</p>
    </div>
    <div v-if="form.payment_evidence" class="rounded-lg border p-3 space-y-2"><p class="text-sm">Payment proof: {{form.payment_evidence.filename}} <span v-if="form.payment_mode==='pay_later'">(supporting evidence only; no payment will be recorded)</span></p><img v-if="form.payment_evidence.mime_type.startsWith('image/')" :src="`/api/po-evidence/${form.payment_evidence.id}`" alt="Uploaded payment receipt preview; not independent verification" class="max-h-48 max-w-full rounded border object-contain" /><div class="flex gap-3 text-sm"><a :href="`/api/po-evidence/${form.payment_evidence.id}`" target="_blank" rel="noopener" class="text-blue-700 underline">View full attachment</a><button type="button" class="underline" @click="form.payment_evidence=undefined;form.funds_confirmed=false">Remove attachment</button></div></div>
    <div v-if="eligibility&&!eligibility.allowed" class="rounded-lg bg-amber-50 p-4 space-y-3"><p class="text-sm font-medium text-amber-900">Customer has an existing hold. Review it before allowing this sale.</p><ul class="list-disc pl-5 text-sm text-amber-900"><li v-for="b in eligibility.blockers" :key="b.invoice_id">{{b.invoice_number}} · {{b.reason}}</li></ul><label class="block text-sm font-medium">Seller exception reason for this sale<textarea v-model.trim="form.override_reason" required maxlength="500" class="form-input" rows="2" /></label></div>
   </fieldset>
   <p v-if="uploading" role="status" class="text-sm text-slate-600">Uploading / reading document…</p><p v-if="uploadError" role="alert" class="text-sm text-rose-700">{{uploadError}}</p>
   <p v-if="!customerId" class="text-sm text-slate-600">Select or add a customer above before issuing the invoice.</p><p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p>
   <button type="submit" class="primary-btn" :disabled="busy||uploading||!customerId||seller.role!=='seller'">{{busy?'Saving…':form.payment_mode==='paid_now'?'Issue invoice, receipt and complete sale':'Issue invoice on agreed terms'}}</button>
  </form>
 </div>
</template>
