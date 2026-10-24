<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {useDemoStore} from '@/composables/useDemoStore';
import {computeInvoiceWithCustomer,DEMO_BUSINESS_ID} from '@/lib/store';
import {customerLang} from '@/lib/reminderTemplates';
import type {RequestLang} from '@/presentation/blockerRequest';
import {whatsappLink} from '@/presentation/blockerRequest';
import {demoPaymentLink,draftPaymentRequest,paymentEmailLink,paymentRequestSubject} from '@/presentation/paymentRequest';
const props=defineProps<{invoiceId:string}>();const {data}=useDemoStore();
const lang=ref<RequestLang>('en');
const langs:{id:RequestLang;label:string}[]=[{id:'en',label:'EN'},{id:'ms',label:'BM'},{id:'zh',label:'中文'}];
const open=ref(false),email=ref(''),phone=ref(''),subject=ref(''),message=ref(''),notice=ref('');
const invoice=computed(()=>{const i=data.value.invoices.find(i=>i.id===props.invoiceId&&i.business_id===DEMO_BUSINESS_ID);return i?computeInvoiceWithCustomer(i,data.value,data.value.demoState.simulated_date):null;});
const blocked=computed(()=>!invoice.value||invoice.value.outstanding_balance<=0||invoice.value.dispute_active||invoice.value.verification_hold);
const paymentLink=computed(()=>invoice.value?demoPaymentLink(window.location.href,invoice.value.invoice_number,invoice.value.outstanding_balance,invoice.value.currency||'MYR'):'');
function resetDraft(preserveRecipients=false){const i=invoice.value;if(!i)return;if(!preserveRecipients){email.value=i.customer?.email||'';phone.value=i.customer?.phone||'';}subject.value=paymentRequestSubject(i.invoice_number,lang.value);
 message.value=draftPaymentRequest(i.customer?.name||'Customer',data.value.businesses.find(b=>b.id===i.business_id)?.name||'Seller',i.invoice_number,i.outstanding_balance,i.currency||'MYR',i.due_date,paymentLink.value,lang.value);notice.value='';}
watch(()=>[props.invoiceId,invoice.value?.outstanding_balance,invoice.value?.currency,invoice.value?.due_date,invoice.value?.dispute_active,invoice.value?.verification_hold],()=>{if(open.value){resetDraft();notice.value='Draft refreshed from the current invoice. Review before sending.';}});
function start(){lang.value=customerLang(invoice.value?.customer);resetDraft();open.value=true;}
function changeLanguage(value:RequestLang){if(value===lang.value)return;lang.value=value;resetDraft(true);notice.value='Subject and message regenerated in the selected language. Review before sending.';}
const mail=computed(()=>blocked.value?null:paymentEmailLink(email.value,subject.value,message.value));
const wa=computed(()=>blocked.value?null:whatsappLink(phone.value,message.value));
async function copy(){try{await navigator.clipboard.writeText(message.value);notice.value='Message copied.';}catch{notice.value='Could not copy automatically. Select and copy the message manually.';}}
</script>
<template>
 <div v-if="invoice" class="space-y-2">
  <button class="outline-btn" type="button" :disabled="blocked" @click="start">Draft payment request · Email / WhatsApp</button>
  <p v-if="blocked" class="text-xs text-slate-500">{{invoice.outstanding_balance<=0?'No payment request needed: this invoice is settled.':'Resolve the dispute or payment-verification hold before requesting payment.'}}</p>
  <div v-if="open&&!blocked" class="rounded-lg border bg-white p-3 space-y-3">
   <div class="flex flex-wrap justify-between items-center gap-2"><h5 class="text-sm font-semibold">Review payment request</h5><div class="inline-flex rounded-md border border-slate-200 p-0.5" role="radiogroup" aria-label="Payment request language"><button v-for="l in langs" :key="l.id" type="button" role="radio" :aria-checked="lang===l.id" class="rounded px-2 py-0.5 text-xs font-medium" :class="lang===l.id?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-50'" @click="changeLanguage(l.id)">{{l.label}}</button></div></div><p class="text-xs text-slate-500">Changing language regenerates the subject and message, replacing edits. Recipient details are kept.</p>
   <div class="grid sm:grid-cols-2 gap-3"><label class="text-xs">Buyer email<input v-model="email" type="email" maxlength="254" class="form-input" /></label><label class="text-xs">WhatsApp phone (include country code)<input v-model="phone" type="tel" maxlength="40" class="form-input" /></label></div>
   <label class="block text-xs">Email subject<input v-model="subject" maxlength="200" class="form-input" /></label>
   <label class="block text-xs">Message<textarea v-model="message" maxlength="6000" rows="10" class="form-input" /></label>
   <div class="flex flex-wrap gap-2"><a v-if="mail&&message.trim()" :href="mail" class="primary-btn">Open email draft</a><span v-else class="text-xs text-slate-500">Enter a valid buyer email and message.</span><a v-if="wa&&message.trim()" :href="wa" target="_blank" rel="noopener noreferrer" class="outline-btn">Open in WhatsApp</a><button class="outline-btn" type="button" @click="copy">Copy message</button><a :href="paymentLink" target="_blank" rel="noopener" class="outline-btn">Preview demo payment link</a><button type="button" class="text-xs underline" @click="open=false">Close</button></div>
   <p v-if="!wa" class="text-xs text-slate-500">Enter the buyer's valid WhatsApp number to open WhatsApp.</p>
   <p class="text-xs text-slate-500">Review recipients and amounts, then send in your email app or WhatsApp. NudgeWise does not send or record delivery. The link is a demo, not a payment gateway; localhost links only work on the computer hosting the app.</p>
   <p v-if="notice" role="status" class="text-xs text-blue-700">{{notice}}</p>
  </div>
 </div>
</template>
