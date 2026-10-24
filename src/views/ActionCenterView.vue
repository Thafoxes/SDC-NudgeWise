<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { blockedOrders } from '@/lib/orderWorkflow';
import { AlertTriangle } from 'lucide-vue-next';
import MessagePreview from '@/components/MessagePreview.vue';
import AttentionQueue from '@/components/AttentionQueue.vue';
import CustomerReplyCard from '@/components/CustomerReplyCard.vue';
import { getAttention, type AttentionItem } from '@/lib/attention';
import { Eye, Check, Pencil, X, Send, Languages } from 'lucide-vue-next';
import ToneStudio from '@/components/ToneStudio.vue';
import { stageTone, customerLang, LANG_SHORT, TONES, type ReminderFacts, type Lang } from '@/presentation/toneStudio';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID, DEMO_BUSINESS_NAME, computeInvoiceWithCustomer } from '@/lib/store';
import { approveFollowUp, rejectFollowUp, editFollowUpMessage, sendApprovedFollowUp, setCustomerLanguage } from '@/services/commands';
import { formatMYR, formatDate, formatDateTime } from '@/lib/format';
import type { FollowUpAction, InvoiceWithCustomer } from '@/types';
import BaseModal from '@/components/BaseModal.vue';
import InvoiceDetailDrawer from '@/components/InvoiceDetailDrawer.vue';
import StatusBadge from '@/components/StatusBadge.vue';
const {data,refreshStore}=useDemoStore();
const seller=computed(()=>data.value.users.find(u=>u.id===DEMO_SELLER_ID)!);
const invoices=computed(()=>data.value.invoices.filter(i=>i.business_id===DEMO_BUSINESS_ID).map(i=>computeInvoiceWithCustomer(i,data.value,data.value.demoState.simulated_date)));
const invMap=computed(()=>new Map(invoices.value.map(i=>[i.id,i])));
const custMap=computed(()=>new Map(data.value.customers.map(c=>[c.id,c])));
const followUps=computed(()=>data.value.followUpActions.filter(f=>f.business_id===DEMO_BUSINESS_ID&&f.checkpoint<5).map(f=>({...f,invoice:invMap.value.get(f.invoice_id),customer:custMap.value.get(f.customer_id)})).sort((a,b)=>b.created_at.localeCompare(a.created_at)));
const responses=computed(()=>data.value.customerResponses.filter(r=>r.business_id===DEMO_BUSINESS_ID).map(r=>({...r,invoice:invMap.value.get(r.invoice_id || ''),customer:custMap.value.get(r.customer_id || '')})).sort((a,b)=>b.created_at.localeCompare(a.created_at)));
type GmailReply={gmail_id:string;thread_id:string|null;order_id:string|null;invoice_id:string|null;document_kind:string|null;document_reference:string|null;sender:string;subject:string;body:string;category:string;explanation:string|null;received_at:string;review_state:string|null};
type GmailMail={id:string;kind:string;reference:string|null;recipient:string;subject:string;state:string;error:string|null;created_at:string;send_mode?:string;thread_id?:string|null;order_id?:string|null};
type GmailTask={id:string;reason:string;customer_id:string|null;invoice_id:string|null;created_at:string};
type GmailOverview={replies:GmailReply[];history:GmailMail[];tasks:GmailTask[];gmail:{incomingEnabled?:boolean;canRead?:boolean};lastSync:string|null};
const gmail=ref<GmailOverview|null>(null);
const gmailLoading=ref(false),gmailError=ref(''),gmailNotice=ref('');
const gmailReplies=computed(()=>gmail.value?.replies||[]);
const gmailReviewCount=computed(()=>gmailReplies.value.filter(r=>['pending','stale'].includes(r.review_state||'')&&r.document_kind!=='test').length);
const realPendingGmailReplies=computed(()=>gmailReplies.value.filter(r=>['pending','stale'].includes(r.review_state||'')&&r.document_kind!=='test'));
const activeReplies=computed(()=>['actions','exceptions','approval'].includes(tab.value)?realPendingGmailReplies.value:gmailReplies.value);
const waitingBuyer=computed(()=>{
 const replies=new Set(gmailReplies.value.map(r=>r.thread_id).filter(Boolean));
 return (gmail.value?.history||[]).filter(m=>m.kind!=='test'&&m.send_mode==='await_reply'&&m.state==='accepted'&&!replies.has(m.thread_id??''));
});
async function refreshGmail(synchronize=false){
 if(gmailLoading.value)return;
 gmailLoading.value=true;gmailError.value='';gmailNotice.value='';
 try{
  if(synchronize){
   const result=await fetch('/api/email/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Nudgewise-Local':'1'},body:'{}'});
   const payload=await result.json();if(!result.ok)throw Error(payload.error||`Reply check failed (HTTP ${result.status})`);
   const status=payload.result??payload;
   gmailNotice.value=status.skipped?String(status.skipped):`Checked tracked Gmail threads: ${Number(status.imported||0)} new replies imported.`;
  }
  const res=await fetch('/api/email/overview',{credentials:'same-origin'});
  const payload=await res.json();if(!res.ok)throw Error(payload.error||`Email service error (HTTP ${res.status})`);
  gmail.value=payload.result??payload;
 }catch(e){gmailError.value=e instanceof Error?e.message:'Email history could not be loaded';}
 finally{gmailLoading.value=false;}
}
async function resolveGmailTask(id:string){
 if(gmailLoading.value)return;gmailLoading.value=true;gmailError.value='';
 try{
  const res=await fetch('/api/email/resolve-task',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Nudgewise-Local':'1'},body:JSON.stringify({id})});
  const payload=await res.json();if(!res.ok)throw Error(payload.error||'Could not resolve task');
  gmail.value=payload.result??payload;
  gmailNotice.value='Communication task marked resolved.';
 }catch(e){gmailError.value=e instanceof Error?e.message:'Could not resolve task';}
 finally{gmailLoading.value=false;}
}
function gmailStage(r:GmailReply){return r.document_kind==='quotation'?'quotation':r.document_kind==='invoice'?'invoice':r.document_kind==='receipt'?'receipt':'order';}
function gmailOrderId(r:GmailReply){return r.order_id||invoices.value.find(i=>i.id===r.invoice_id)?.purchase_order_id||null;}
function previewReply(body:string){
 // Display buyer's actual reply first, before the quoted conversation and headers.
 return (body||'').split(/\n\s*(?:On .{6,180}wrote:|From:|[-]{2,}\s*Original Message)/i)[0].trim().slice(0,1200)||'(No text preview)';
}
function emailDate(value:string){return value?value.replace('T',' ').slice(0,19):'—';}
let gmailTimer:ReturnType<typeof setInterval>|undefined;
onMounted(()=>{void refreshGmail();gmailTimer=setInterval(()=>{if(!document.hidden)void refreshGmail();},30000);});
onUnmounted(()=>{if(gmailTimer)clearInterval(gmailTimer);});
const exceptions=computed(()=>getAttention(data.value,DEMO_BUSINESS_ID,data.value.demoState.simulated_date));
const activity=computed(()=>data.value.activityEvents.filter(a=>a.business_id===DEMO_BUSINESS_ID).slice(0,50));
const blocked=computed(()=>{void data.value;return blockedOrders(DEMO_BUSINESS_ID);});
const router=useRouter();
const tab=ref<'actions'|'awaiting'|'communications'|'completed'|'all'|'approval'|'responses'|'exceptions'|'blocked'|'history'|'email'>('actions');
const tabs=computed(()=>[
 {id:'actions',label:'Needs My Action',count:followUps.value.filter(f=>f.approval_state==='pending').length+realPendingGmailReplies.value.length+(gmail.value?.tasks.length||0)+blocked.value.length+exceptions.value.filter(i=>i.kind!=='approval').length},
 {id:'awaiting',label:'Awaiting Buyer',count:waitingBuyer.value.length},
 {id:'communications',label:'Communications',count:gmailReplies.value.length},
 {id:'completed',label:'Completed',count:0},
] as const);
const selectedId=ref<string|null>(null),drawerOpen=ref(false),editId=ref<string|null>(null),editText=ref(''),editError=ref(''),toast=ref('');
const selected=computed(()=>invoices.value.find(i=>i.id===selectedId.value)??null);
function openInvoice(i:InvoiceWithCustomer){selectedId.value=i.id;drawerOpen.value=true;}
async function reviewAttention(item:AttentionItem){
 if(item.kind==='response'||item.kind==='receipt'){
  tab.value=item.kind==='response'?'communications':'actions';await nextTick();
  const element=document.getElementById(`${item.kind==='response'?'response':'receipt'}-${item.target}`);element?.focus({preventScroll:true});element?.scrollIntoView({block:'start'});
 }else{const invoice=invoices.value.find(i=>i.id===item.invoiceId);if(invoice)openInvoice(invoice);}
}
let toastTimer:ReturnType<typeof setTimeout>|undefined;
function notice(msg:string){toast.value=msg;if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',3900);}
const studioId=ref<string|null>(null);
const studioFollowUp=computed(()=>followUps.value.find(f=>f.id===studioId.value)??null);
const studioFacts=computed<ReminderFacts|null>(()=>{const f=studioFollowUp.value;if(!f?.invoice)return null;return{customerName:f.customer?.name??'Customer',invoiceNumber:f.invoice.invoice_number,amount:f.invoice.outstanding_balance,dueDate:f.invoice.due_date,daysOverdue:f.invoice.days_overdue,businessName:data.value.businesses.find(b=>b.id===DEMO_BUSINESS_ID)?.name??DEMO_BUSINESS_NAME};});
function toneChip(f:FollowUpAction&{customer?:{preferred_language?:string|null}}){const t=stageTone(f.checkpoint);return `${LANG_SHORT[customerLang(f.customer)]} · ${TONES.find(x=>x.id===t)?.label}`;}
async function applyStudio(text:string,rememberLang:Lang|null){if(!studioId.value)return;const fu=studioFollowUp.value;if(rememberLang&&fu)await setCustomerLanguage(fu.customer_id,rememberLang,seller.value.name,seller.value.role);const r=await editFollowUpMessage(studioId.value,text,seller.value.name,seller.value.role);notice(r.success?'New message saved — approve it when ready.':r.error||'Could not save message');if(r.success)studioId.value=null;refreshStore();}
async function execute(fn:()=>Promise<{success:boolean;error?:string}>,ok:string){const r=await fn();notice(r.success?ok:r.error||'Action failed');refreshStore();}
function beginEdit(f:FollowUpAction){editId.value=f.id;editText.value=f.message;editError.value='';}
async function saveEdit(){if(!editId.value)return;if(!editText.value.trim()){editError.value='Message is required';return;}const result=await editFollowUpMessage(editId.value,editText.value,seller.value.name,seller.value.role);if(result.success){editId.value=null;notice('Reminder saved; approval reset.');}else editError.value=result.error||'Could not edit';refreshStore();}
const route=useRoute();
let handledRoute='';
watch([()=>route.fullPath,data],async()=>{
 if(handledRoute===route.fullPath)return;
 const reply=typeof route.query.reply==='string'?route.query.reply:'';
 const receipt=typeof route.query.receipt==='string'?route.query.receipt:'';
 if(reply)tab.value='communications';
 else if(receipt)tab.value='actions';
 else if(route.query.tab==='responses'||route.query.tab==='email')tab.value='communications';
 else if(route.query.tab==='exceptions'||route.query.tab==='approval'||route.query.tab==='blocked')tab.value='actions';
 else if(['actions','awaiting','communications','completed'].includes(String(route.query.tab)))tab.value=route.query.tab as typeof tab.value;
 await nextTick();
 if(reply||receipt){const element=document.getElementById(reply?`response-${reply}`:`receipt-${receipt}`);if(!element)return;element.focus({preventScroll:true});element.scrollIntoView({block:'start'});}
 if(typeof route.query.invoice==='string'){const invoice=invoices.value.find(i=>i.id===route.query.invoice);if(!invoice)return;openInvoice(invoice);}
 handledRoute=route.fullPath;
},{immediate:true});
</script>
<template>
<div class="space-y-5">
 <div class="card flex flex-col gap-2 border-l-4 border-l-blue-600 bg-blue-50 p-4">
  <h2 class="font-semibold text-slate-900">Seller action workspace</h2>
  <p class="text-sm text-slate-700">Check <strong>Needs My Action</strong> for decisions to make, <strong>Awaiting Buyer</strong> for sent documents without replies, and <strong>Communications</strong> for the message trail. AI findings are suggestions, never approved decisions.</p>
 </div>

 <div v-if="toast" role="status" class="fixed right-5 top-20 z-50 rounded-xl bg-orbyte-ink p-3 text-sm text-white shadow-xl">{{toast}}</div>
 <div class="card flex flex-wrap gap-1.5 p-1.5"><button v-for="t in tabs" :key="t.id" @click="tab=t.id" :aria-pressed="tab===t.id" class="rounded-lg px-3.5 py-2 text-sm font-medium transition" :class="tab===t.id?'bg-orbyte-button text-white shadow-sm':'text-orbyte-muted hover:bg-orbyte-bg'">{{t.label}} <span v-if="t.count" class="ml-1 rounded-full px-1.5 text-[10px]" :class="tab===t.id?'bg-white/20':'bg-orbyte-bg'">{{t.count}}</span></button></div>
 <section v-if="tab==='awaiting'" class="card p-4 sm:p-5 space-y-3" aria-label="Awaiting buyer email reply">
  <div class="flex justify-between gap-3"><h3 class="font-semibold">Sent documents awaiting buyer response</h3><button type="button" class="outline-btn" :disabled="gmailLoading" @click="refreshGmail(true)">Check Replies Now</button></div>
  <p v-if="!waitingBuyer.length" class="text-sm text-slate-600">No outstanding monitored document replies in the current email history.</p>
  <article v-for="e in waitingBuyer" :key="e.id" class="rounded-lg border border-slate-200 p-3 text-sm">
   <div class="flex flex-wrap justify-between gap-2"><strong>{{e.kind}} · {{e.reference||'Document'}}</strong><span class="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Awaiting buyer reply</span></div>
   <p class="mt-1 text-xs text-slate-600">To {{e.recipient}} · sent {{emailDate(e.created_at)}}</p>
   <p class="text-xs text-slate-500">Gmail accepted the message; inbox delivery is not confirmed.</p>
  </article>
 </section>
 <section v-if="tab==='actions'||tab==='all'||tab==='approval'" class="space-y-3"><h3 class="text-sm font-semibold">Simulated Reminder Approvals</h3><p v-if="!followUps.length" class="card p-6 text-sm text-orbyte-muted">No reminders yet. Use Demo Controls → Run Invoice Check to create drafts.</p>
   <div v-for="f in followUps" :key="f.id" class="card p-5"><div class="flex flex-col gap-4 lg:flex-row lg:justify-between"><div class="space-y-2 flex-1"><div class="flex flex-wrap items-center gap-2"><h4 class="font-semibold">{{f.customer?.name||'—'}}</h4><span class="text-sm text-orbyte-muted">{{f.invoice?.invoice_number}}</span><StatusBadge v-if="f.invoice" :status="f.invoice.status"/></div>
     <div class="flex flex-wrap gap-4 text-xs text-orbyte-muted"><span>Outstanding: <b class="text-orbyte-ink">{{formatMYR(f.invoice?.outstanding_balance||0)}}</b></span><span>Due: {{formatDate(f.invoice?.due_date||'')}}</span><span>Checkpoint: {{f.checkpoint}}</span><span v-if="f.invoice?.days_overdue" class="text-red-600">{{f.invoice.days_overdue}} days overdue</span></div>
     <p class="text-xs text-orbyte-muted">{{f.reason}} <span class="ml-1 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[12px] font-medium text-purple-700" title="Language from the customer's preference; tone set by how late the invoice is">{{toneChip(f)}} · auto</span></p><MessagePreview :message="f.message" :recipient-name="f.customer?.name" :sender-name="seller.name" /><div class="flex gap-2 items-center text-xs"><span class="rounded-md bg-amber-50 px-2 py-1 capitalize text-amber-700">{{f.approval_state}}</span><span class="rounded-md bg-slate-50 px-2 py-1 capitalize text-slate-600">{{f.send_state}}</span><span v-if="f.delivery_status" class="text-orbyte-muted">{{f.delivery_status}}</span></div></div>
     <div class="flex flex-wrap gap-2 lg:flex-col lg:min-w-[155px]"><template v-if="f.approval_state==='pending'"><button class="success-btn" @click="execute(()=>approveFollowUp(f.id,seller.id,seller.name,seller.role),'Reminder approved')"><Check class="w-4 h-4"/>Approve</button><button class="outline-btn" @click="studioId=f.id"><Languages class="w-4 h-4"/>Tone &amp; language</button><button class="outline-btn" @click="beginEdit(f)"><Pencil class="w-4 h-4"/>Edit</button><button class="danger-btn" @click="execute(()=>rejectFollowUp(f.id,seller.name,seller.role),'Reminder rejected')"><X class="w-4 h-4"/>Reject</button></template>
       <button v-if="f.approval_state==='approved'&&f.send_state==='not_sent'" class="primary-btn" @click="execute(()=>sendApprovedFollowUp(f.id,seller.name),'Message sent (simulated only)')"><Send class="w-4 h-4"/>Send (Simulation)</button>
       <button v-if="f.invoice" class="outline-btn" @click="openInvoice(f.invoice)"><Eye class="w-4 h-4"/>View Invoice</button></div></div></div>
 </section>
 <section v-if="tab==='actions'||tab==='communications'||tab==='all'||tab==='responses'" class="space-y-3">
   <div class="flex flex-wrap justify-between items-center gap-2"><div><h3 class="text-sm font-semibold">Customer Responses &amp; Buyer Emails</h3><p class="text-xs text-orbyte-muted mt-1">Gmail conversations are stored in the email service, separately from simulated customer response records.</p></div><button type="button" class="outline-btn" :disabled="gmailLoading" @click="refreshGmail(true)">Check Gmail Replies Now</button></div>
   <p v-if="gmailError" role="alert" class="text-sm text-rose-700">{{gmailError}}</p><p v-if="gmailNotice" role="status" class="text-sm text-emerald-700">{{gmailNotice}}</p>
   <div v-if="activeReplies.length" class="card p-4 space-y-4">
    <h4 class="font-semibold text-sm">Received Gmail Replies <span class="text-xs font-normal text-orbyte-muted">({{gmailReviewCount}} awaiting review)</span></h4>
    <article v-for="r in activeReplies" :key="r.gmail_id" class="border-b pb-3 last:border-b-0 space-y-2">
      <div class="flex flex-wrap items-center gap-2 text-sm"><strong class="break-all">{{r.sender}}</strong><span class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">AI suggests: {{r.category.replace(/_/g,' ')}}</span><span v-if="r.document_kind==='test'||r.review_state==='test'" class="rounded bg-slate-100 px-2 py-0.5 text-xs">Test only</span><span v-else-if="r.review_state==='stale'" class="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-700">Older quotation version — review only</span><span v-else-if="r.review_state==='pending'" class="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Seller review required</span></div>
      <p class="text-xs text-orbyte-muted break-words">{{r.document_reference||r.document_kind||'Email'}} · {{r.subject}} · {{emailDate(r.received_at)}}</p>
      <p class="whitespace-pre-wrap break-words text-sm">{{previewReply(r.body)}}</p>
      <details class="text-xs"><summary class="cursor-pointer text-blue-700">View original email evidence</summary><pre class="mt-2 whitespace-pre-wrap break-all rounded bg-slate-50 p-3">{{r.body}}</pre><p class="text-orbyte-muted">Gmail message ID: {{r.gmail_id}}</p></details>
      <p v-if="r.explanation" class="text-xs text-orbyte-muted">Analysis: {{r.explanation}}</p>
      <button v-if="gmailOrderId(r)&&r.document_kind!=='test'" type="button" class="outline-btn" @click="router.push(`/orders/${encodeURIComponent(gmailOrderId(r)!)}/view?stage=${gmailStage(r)}`)">Review related order</button>
      <p v-else-if="r.document_kind!=='test'" class="text-xs text-orbyte-muted">No order link; seller must review the matching invoice or contact record.</p>
    </article>
   </div>
   <p v-if="!responses.length&&!activeReplies.length" class="card p-6 text-sm text-orbyte-muted">No buyer replies in this view.</p>
  <CustomerReplyCard v-for="r in (tab==='communications'?responses:responses.filter(r=>r.review_status==='pending'))" :key="r.id" :response="r" :invoice="r.invoice" :customer-name="r.customer?.name" :seller-name="seller.name" @review-invoice="openInvoice"/>
 </section>
 <AttentionQueue v-if="(tab==='actions'||tab==='all'||tab==='exceptions')&&(exceptions.length>0||!(gmail?.tasks.length||gmailReviewCount))" @review="reviewAttention"/>
 <section v-if="tab==='actions'||tab==='all'||tab==='exceptions'" class="card p-4 space-y-3" aria-label="Email follow-up tasks">
  <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold">Email Follow-up Tasks</h3><button type="button" class="outline-btn" :disabled="gmailLoading" @click="refreshGmail()">Refresh</button></div>
  <p v-if="!gmail?.tasks.length" class="text-xs text-orbyte-muted">No outstanding email follow-up tasks.</p>
  <div v-for="task in (tab==='all'?gmail?.tasks.slice(0,5)||[]:gmail?.tasks||[])" :key="task.id" class="border-t pt-3 flex flex-wrap items-start justify-between gap-2"><div class="max-w-3xl"><p class="text-sm">{{task.reason}}</p><p class="text-xs text-orbyte-muted">{{emailDate(task.created_at)}}</p></div><button type="button" class="outline-btn" :disabled="gmailLoading" @click="resolveGmailTask(task.id)">Mark resolved</button></div>
 </section>
 <section v-if="tab==='actions'||tab==='all'||tab==='blocked'" class="space-y-3" aria-label="Blocked orders"><h3 class="text-sm font-semibold">Blocked orders</h3>
  <p class="text-xs text-orbyte-muted">These orders cannot be invoiced or followed up until someone acts. Reminders stay paused.</p>
  <p v-if="!blocked.length" class="card p-6 text-sm text-orbyte-muted">No blocked orders. Every order can move to its next step.</p>
  <article v-for="b in blocked" :key="b.order.id" class="card flex flex-col gap-3 border-l-4 border-l-rose-500 p-4 sm:flex-row sm:items-center sm:justify-between">
   <div class="min-w-0 space-y-1.5"><p class="text-sm font-semibold">{{custMap.get(b.order.customer_id)?.name||'Customer'}} · {{b.order.reference}}</p>
    <div v-for="(x,i) in b.blockers" :key="i" class="text-sm"><p class="flex items-start gap-1.5 text-rose-800"><AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />{{x.reason}}</p>
     <p class="pl-5 text-xs text-orbyte-muted"><span class="font-medium text-slate-700">Owner: {{x.owner}}</span> · Next: {{x.action}}<template v-if="x.evidence_id"> · <a :href="`/api/po-evidence/${x.evidence_id}`" target="_blank" rel="noopener" class="text-blue-700 underline">View evidence</a></template></p></div></div>
   <button type="button" class="primary-btn shrink-0 self-start sm:self-center" @click="router.push(`/orders/${encodeURIComponent(b.order.id)}/view`)">Open order</button>
  </article>
 </section>
 <section v-if="tab==='communications'||tab==='all'||tab==='email'" class="card p-4 sm:p-5 space-y-3" aria-label="Email history">
  <div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-semibold">Email History</h3><p class="text-xs text-orbyte-muted">Gmail acceptance is not inbox delivery confirmation.</p></div><button type="button" class="outline-btn" :disabled="gmailLoading" @click="refreshGmail()">Refresh</button></div>
  <p v-if="gmailError" role="alert" class="text-xs text-rose-700">{{gmailError}}</p>
  <p v-if="!gmail?.history.length" class="text-sm text-orbyte-muted">No sent emails recorded.</p>
  <article v-for="e in (tab==='all'?gmail?.history.slice(0,5)||[]:gmail?.history||[])" :key="e.id" class="border-t pt-3 space-y-1">
   <div class="flex flex-wrap gap-2 text-sm"><strong>{{e.kind}} · {{e.reference||'Test'}}</strong><span class="rounded bg-slate-100 px-2 text-xs">{{e.state}}</span><span v-if="e.send_mode==='await_reply'" class="rounded bg-blue-50 px-2 text-xs text-blue-700">Waiting for reply</span></div>
   <p class="text-xs break-all">To: {{e.recipient}} · {{e.subject}}</p><p class="text-xs text-orbyte-muted">{{emailDate(e.created_at)}} <span v-if="e.error" class="text-rose-700">· {{e.error}}</span></p>
  </article>
 </section>
 <section v-if="tab==='completed'||tab==='history'" class="card p-5"><h3 class="font-semibold mb-4">Activity History</h3><p v-if="!activity.length" class="empty-text">No activity yet.</p><div v-for="(e,k) in activity" :key="e.id" class="border-l-2 pl-4 py-2" :class="k===0?'border-orbyte-blue':'border-orbyte-border'"><p class="text-sm">{{e.description}}</p><p class="text-xs text-orbyte-muted mt-1">{{formatDateTime(e.created_at)}} · {{e.actor}} ({{e.actor_role}})</p></div></section>
 <InvoiceDetailDrawer :invoice="selected" :open="drawerOpen" :seller-name="seller.name" :seller-role="seller.role" @close="drawerOpen=false"/>
 <BaseModal :open="!!editId" title="Edit Reminder Message" @close="editId=null"><p class="text-sm text-orbyte-muted mb-3">Changing the reminder invalidates previous approval. Seller approval is required again.</p><p v-if="editError" class="text-sm text-red-600 mb-2">{{editError}}</p><textarea v-model="editText" rows="6" class="form-input"></textarea><template #footer><div class="flex justify-end gap-2"><button class="outline-btn" @click="editId=null">Cancel</button><button class="primary-btn" @click="saveEdit">Save & Reset Approval</button></div></template></BaseModal>
 <ToneStudio :open="!!studioId" :follow-up-id="studioId" :facts="studioFacts" :current-message="studioFollowUp?.message ?? ''" :default-tone="stageTone(studioFollowUp?.checkpoint ?? 2)" :saved-lang="customerLang(studioFollowUp?.customer)" @close="studioId=null" @apply="applyStudio" />
</div>
</template>
