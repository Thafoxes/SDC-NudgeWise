<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {useDemoStore} from '@/composables/useDemoStore';
import {computeInvoiceWithCustomer,DEMO_BUSINESS_ID} from '@/lib/store';
import {customerLang} from '@/lib/reminderTemplates';
import type {RequestLang} from '@/presentation/blockerRequest';
import {paymentRequestSubject} from '@/presentation/paymentRequest';
const props=defineProps<{invoiceId:string}>();const {data}=useDemoStore();
const lang=ref<RequestLang>('en');
const languages:{id:RequestLang;label:string}[]=[{id:'en',label:'EN'},{id:'ms',label:'BM'},{id:'zh',label:'中文'}];
const open=ref(false),email=ref(''),subject=ref(''),message=ref(''),notice=ref(''),error=ref(''),busy=ref(false),confirmed=ref(false);
const mode=ref<'send_only'|'await_reply'>('await_reply');
const invoice=computed(()=>{const record=data.value.invoices.find(i=>i.id===props.invoiceId&&i.business_id===DEMO_BUSINESS_ID);return record?computeInvoiceWithCustomer(record,data.value,data.value.demoState.simulated_date):null;});
const blocked=computed(()=>!invoice.value||invoice.value.outstanding_balance<=0||invoice.value.dispute_active||invoice.value.verification_hold);
function resetDraft(preserveRecipient=false){const i=invoice.value;if(!i)return;if(!preserveRecipient)email.value=i.customer?.email||'';
 subject.value=paymentRequestSubject(i.invoice_number,lang.value);
 const money=`${i.currency||'MYR'} ${i.outstanding_balance.toFixed(2)}`;
 const seller=data.value.businesses.find(b=>b.id===i.business_id)?.name||'Seller';
 if(lang.value==='ms')message.value=`Salam ${i.customer?.name||'Pelanggan'},\n\nSila semak invois ${i.invoice_number}.\nBaki tertunggak: ${money}\nTarikh akhir bayaran: ${i.due_date}\n\nJika sudah dibayar, sila kongsi rujukan pembayaran untuk pengesahan. Jangan membuat bayaran dua kali.\n\nTerima kasih,\n${seller}`;
 else if(lang.value==='zh')message.value=`您好，${i.customer?.name||'客户'}：\n\n请查阅发票 ${i.invoice_number}。\n未付余额：${money}\n付款截止日期：${i.due_date}\n\n如果已经付款，请提供支付参考编号，以便我们核实。请勿重复付款。\n\n谢谢！\n${seller}`;
 else message.value=`Hello ${i.customer?.name||'Customer'},\n\nPlease review invoice ${i.invoice_number}.\nOutstanding balance: ${money}\nDue date: ${i.due_date}\n\nIf you have already paid, please share the payment reference so we can verify it. Please do not make a duplicate payment.\n\nThank you,\n${seller}`;
 if(mode.value==='await_reply')message.value+='\n\nPlease reply to confirm your payment plan, request a change with reasons, or explain any dispute. Your reply will be reviewed by the seller.';
 confirmed.value=false;notice.value='';error.value='';}
function start(){lang.value=customerLang(invoice.value?.customer);mode.value='await_reply';resetDraft();open.value=true;}
function changeLanguage(value:RequestLang){lang.value=value;resetDraft(true);}
watch(()=>[props.invoiceId,invoice.value?.outstanding_balance,invoice.value?.due_date,invoice.value?.dispute_active,invoice.value?.verification_hold],()=>{if(open.value){resetDraft();notice.value='Draft refreshed for current invoice balance.';}});
async function send(){if(busy.value||!confirmed.value||blocked.value)return;busy.value=true;error.value='';notice.value='';try{
 const response=await fetch('/api/email/payment-request',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NudgeWise-Local':'1'},body:JSON.stringify({invoiceId:props.invoiceId,to:email.value,subject:subject.value,message:message.value,mode:mode.value,confirmed:true})});
 const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);
 notice.value='Gmail accepted the payment request. Inbox delivery is not guaranteed.';open.value=false;confirmed.value=false;
 }catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
</script>
<template>
 <div v-if="invoice" class="space-y-2">
  <button type="button" class="outline-btn" :disabled="blocked" @click="start">Send payment request with Gmail</button>
  <p v-if="blocked" class="text-xs text-slate-500">{{invoice.outstanding_balance<=0?'No reminder required for a settled invoice.':'Resolve the payment dispute or verification hold first.'}}</p>
  <div v-if="open&&!blocked" class="rounded-lg border bg-white p-3 space-y-3">
   <div class="flex flex-wrap items-center justify-between gap-2"><h5 class="font-semibold text-sm">Review payment request · {{invoice.invoice_number}}</h5><div class="inline-flex rounded-md border p-0.5" aria-label="Payment request language"><button v-for="l in languages" :key="l.id" type="button" class="rounded px-2 py-0.5 text-xs" :class="lang===l.id?'bg-slate-900 text-white':'text-slate-600'" @click="changeLanguage(l.id)">{{l.label}}</button></div></div>
   <label class="block text-xs">Email mode<select v-model="mode" class="form-input" @change="resetDraft(true)"><option value="send_only">Send Only</option><option value="await_reply">Send &amp; Wait for Reply</option></select></label>
   <p class="text-xs text-slate-500">{{mode==='await_reply'?'Replies will be analyzed and routed to seller review.':'No buyer-response workflow is started.'}}</p>
   <label class="block text-xs">Buyer email<input v-model.trim="email" type="email" required maxlength="254" class="form-input" /></label>
   <label class="block text-xs">Email subject<input v-model="subject" maxlength="170" class="form-input" /></label>
   <label class="block text-xs">Message<textarea v-model="message" rows="9" maxlength="6000" class="form-input" /></label>
   <label class="flex items-start gap-2 text-xs"><input v-model="confirmed" type="checkbox" class="mt-1" /><span>I reviewed the recipient, invoice balance and message, and authorize this Gmail message.</span></label>
   <div class="flex flex-wrap gap-2"><button type="button" class="primary-btn" :disabled="busy||!confirmed||!email||!message.trim()" @click="send">{{busy?'Sending…':'Send directly with Gmail'}}</button><button type="button" class="outline-btn" :disabled="busy" @click="open=false">Cancel</button></div>
   <p v-if="error" class="text-xs text-rose-700" role="alert">{{error}}</p>
  </div>
  <p v-if="notice" class="text-xs text-emerald-700" role="status">{{notice}}</p>
 </div>
</template>
