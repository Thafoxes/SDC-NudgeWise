<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue';
import type {PurchaseOrder} from '@/types';
import type {Quotation} from '@/lib/orderWorkflow';
const props=defineProps<{order:PurchaseOrder;quotation:Quotation|null;invoiceNumber:string|null}>();
const emit=defineEmits<{(e:'select',stage:'order'|'quotation'|'invoice'):void}>();
type Mail={id:string;order_id:string|null;invoice_id:string|null;kind:string;reference:string;state:string;recipient:string;created_at:string;subject:string;thread_id:string|null;send_mode?:'send_only'|'await_reply'};
type Reply={gmail_id:string;thread_id:string;order_id:string|null;document_kind:string|null;document_reference:string|null;category:string;explanation:string;sender:string;body:string;received_at:string};
const mails=ref<Mail[]>([]),replies=ref<Reply[]>([]),error=ref(''),loading=ref(false);
let timer:ReturnType<typeof setInterval>|undefined;
async function reload(){if(loading.value)return;loading.value=true;try{
 const res=await fetch('/api/email/overview',{credentials:'same-origin'});if(!res.ok)throw Error('Email service unavailable');
 const out=await res.json();mails.value=out.result?.history||[];replies.value=out.result?.replies||[];error.value='';
 }catch(e){error.value=(e as Error).message;}finally{loading.value=false;}}
onMounted(()=>{void reload();timer=setInterval(()=>void reload(),30000);});
onUnmounted(()=>{if(timer)clearInterval(timer);});
watch(()=>props.order.id,()=>void reload());
const stages=computed(()=>[
 {kind:'po',label:'Purchase Order',reference:props.order.source_mode==='quick_sale'?'Not required':props.order.reference,decision:props.order.source_mode==='quick_sale'?'Not required':props.order.status==='approved'?'Seller approved':'Draft — seller review',select:'order' as const},
 {kind:'quotation',label:'Quotation',reference:props.quotation?.reference||'Not created',decision:props.quotation?.status==='accepted'?'Approved by seller':props.quotation?.status==='rejected'?'Rejected by seller':props.quotation?.status==='revision_requested'?'Revision requested':props.quotation?.status==='sent'?'Awaiting buyer':'Pending buyer acceptance',select:'quotation' as const},
 {kind:'invoice',label:'Invoice',reference:props.invoiceNumber||'Not issued',decision:'Buyer approval not normally required',select:'invoice' as const},
]);
function outgoing(kind:string){return mails.value.filter(m=>m.order_id===props.order.id&&m.kind===kind).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];}
function responses(kind:string){const latest=outgoing(kind);if(latest?.send_mode==='send_only')return [];return replies.value.filter(r=>r.order_id===props.order.id&&r.document_kind===kind&&(!latest?.thread_id||r.thread_id===latest.thread_id)).sort((a,b)=>b.received_at.localeCompare(a.received_at));}
function emailStatus(kind:string){if(props.order.source_mode==='quick_sale'&&(kind==='po'||kind==='quotation'))return 'Not applicable';const m=outgoing(kind);if(!m)return 'Not sent';if(m.state==='needs_review')return 'Sending needs review';if(m.state==='sending')return 'Sending';if(m.state==='accepted')return m.send_mode==='send_only'?'Sent · no reply requested':responses(kind).length?'Reply received':'Sent · Awaiting reply';return m.state;}
function displayCategory(category:string){return ({accepted:'Possible acceptance',rejected:'Possible rejection',revision_requested:'Changes requested',unclear:'Needs clarification',payment_promise:'Possible payment promise',payment_claim:'Payment claim',dispute:'Dispute'} as Record<string,string>)[category]||category.replace(/_/g,' ');}
</script>
<template>
 <section class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3" aria-label="Approvals and confirmations">
  <div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">Approvals &amp; Confirmations</h3><p class="text-xs text-slate-500 mt-1">Email status, buyer's original reply, and seller-confirmed decisions are tracked separately.</p></div><button type="button" class="outline-btn" :disabled="loading" @click="reload">Refresh</button></div>
  <p v-if="error" role="status" class="text-xs text-amber-800">Email history is unavailable: {{error}}. Existing order decisions are still shown.</p>
  <div class="overflow-x-auto"><table class="w-full min-w-[630px] text-xs text-left"><thead class="bg-slate-50 text-slate-600"><tr><th class="p-2">Document</th><th class="p-2">Reference</th><th class="p-2">Email status</th><th class="p-2">Recorded decision</th><th class="p-2">Review</th></tr></thead>
   <tbody><tr v-for="s in stages" :key="s.kind" class="border-t"><td class="p-2 font-semibold">{{s.label}}</td><td class="p-2 font-mono">{{s.reference}}</td><td class="p-2">{{emailStatus(s.kind)}}</td><td class="p-2">{{s.decision}}</td><td class="p-2"><button class="text-blue-700 underline" @click="emit('select',s.select)">Open {{s.label}}</button></td></tr></tbody></table></div>
  <div v-for="reply in [...responses('po'),...responses('quotation'),...responses('invoice')].sort((a,b)=>b.received_at.localeCompare(a.received_at)).slice(0,8)" :key="reply.gmail_id" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
   <p class="font-semibold">Buyer reply · {{reply.document_reference||reply.document_kind}} · {{displayCategory(reply.category)}}</p>
   <p class="text-xs text-slate-600">{{reply.sender}} · {{reply.received_at?.replace('T',' ').slice(0,16)}} · <strong>Seller review required</strong></p>
   <p class="whitespace-pre-wrap break-words text-xs border-l-2 border-amber-400 pl-2">{{reply.body}}</p>
   <p class="text-xs text-slate-600">AI: {{reply.explanation}}</p>
   <button type="button" class="text-blue-700 text-xs underline" @click="emit('select',reply.document_kind==='quotation'?'quotation':reply.document_kind==='po'?'order':'invoice')">Open document to record seller decision</button>
  </div>
  <p class="text-xs text-slate-500">Gmail accepted ≠ delivered; buyer reply ≠ seller approval. Quotation acceptance must be confirmed in the selected Quotation section. Attachments and evidence can be added there.</p>
 </section>
</template>
