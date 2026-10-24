<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
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
const exceptions=computed(()=>getAttention(data.value,DEMO_BUSINESS_ID,data.value.demoState.simulated_date));
const activity=computed(()=>data.value.activityEvents.filter(a=>a.business_id===DEMO_BUSINESS_ID).slice(0,50));
const blocked=computed(()=>{void data.value;return blockedOrders(DEMO_BUSINESS_ID);});
const router=useRouter();
const tab=ref<'all'|'approval'|'responses'|'exceptions'|'blocked'|'history'>('approval');
const tabs=computed(()=>[
 {id:'all',label:'All',count:0},{id:'approval',label:'Awaiting Approval',count:followUps.value.filter(f=>f.approval_state==='pending').length},
 {id:'responses',label:'Customer Responses',count:responses.value.filter(r=>r.review_status==='pending').length},
 {id:'exceptions',label:'Needs attention',count:exceptions.value.length},{id:'blocked',label:'Blocked orders',count:blocked.value.length},{id:'history',label:'History',count:0},
] as const);
const selectedId=ref<string|null>(null),drawerOpen=ref(false),editId=ref<string|null>(null),editText=ref(''),editError=ref(''),toast=ref('');
const selected=computed(()=>invoices.value.find(i=>i.id===selectedId.value)??null);
function openInvoice(i:InvoiceWithCustomer){selectedId.value=i.id;drawerOpen.value=true;}
async function reviewAttention(item:AttentionItem){
 if(item.kind==='response'||item.kind==='receipt'){
  tab.value=item.kind==='response'?'responses':'exceptions';await nextTick();
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
 if(reply)tab.value='responses';
 else if(receipt)tab.value='exceptions';
 else if(route.query.tab==='exceptions'||route.query.tab==='approval'||route.query.tab==='blocked')tab.value=route.query.tab;
 await nextTick();
 if(reply||receipt){const element=document.getElementById(reply?`response-${reply}`:`receipt-${receipt}`);if(!element)return;element.focus({preventScroll:true});element.scrollIntoView({block:'start'});}
 if(typeof route.query.invoice==='string'){const invoice=invoices.value.find(i=>i.id===route.query.invoice);if(!invoice)return;openInvoice(invoice);}
 handledRoute=route.fullPath;
},{immediate:true});
</script>
<template>
<div class="space-y-5">

 <div v-if="toast" role="status" class="fixed right-5 top-20 z-50 rounded-xl bg-orbyte-ink p-3 text-sm text-white shadow-xl">{{toast}}</div>
 <div class="card flex flex-wrap gap-1.5 p-1.5"><button v-for="t in tabs" :key="t.id" @click="tab=t.id" :aria-pressed="tab===t.id" class="rounded-lg px-3.5 py-2 text-sm font-medium transition" :class="tab===t.id?'bg-orbyte-button text-white shadow-sm':'text-orbyte-muted hover:bg-orbyte-bg'">{{t.label}} <span v-if="t.count" class="ml-1 rounded-full px-1.5 text-[10px]" :class="tab===t.id?'bg-white/20':'bg-orbyte-bg'">{{t.count}}</span></button></div>
 <section v-if="tab==='all'||tab==='approval'" class="space-y-3"><h3 class="text-sm font-semibold">Reminder Approvals</h3><p v-if="!followUps.length" class="card p-6 text-sm text-orbyte-muted">No reminders yet. Use Demo Controls → Run Invoice Check to create drafts.</p>
   <div v-for="f in followUps" :key="f.id" class="card p-5"><div class="flex flex-col gap-4 lg:flex-row lg:justify-between"><div class="space-y-2 flex-1"><div class="flex flex-wrap items-center gap-2"><h4 class="font-semibold">{{f.customer?.name||'—'}}</h4><span class="text-sm text-orbyte-muted">{{f.invoice?.invoice_number}}</span><StatusBadge v-if="f.invoice" :status="f.invoice.status"/></div>
     <div class="flex flex-wrap gap-4 text-xs text-orbyte-muted"><span>Outstanding: <b class="text-orbyte-ink">{{formatMYR(f.invoice?.outstanding_balance||0)}}</b></span><span>Due: {{formatDate(f.invoice?.due_date||'')}}</span><span>Checkpoint: {{f.checkpoint}}</span><span v-if="f.invoice?.days_overdue" class="text-red-600">{{f.invoice.days_overdue}} days overdue</span></div>
     <p class="text-xs text-orbyte-muted">{{f.reason}} <span class="ml-1 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[12px] font-medium text-purple-700" title="Language from the customer's preference; tone set by how late the invoice is">{{toneChip(f)}} · auto</span></p><MessagePreview :message="f.message" :recipient-name="f.customer?.name" :sender-name="seller.name" /><div class="flex gap-2 items-center text-xs"><span class="rounded-md bg-amber-50 px-2 py-1 capitalize text-amber-700">{{f.approval_state}}</span><span class="rounded-md bg-slate-50 px-2 py-1 capitalize text-slate-600">{{f.send_state}}</span><span v-if="f.delivery_status" class="text-orbyte-muted">{{f.delivery_status}}</span></div></div>
     <div class="flex flex-wrap gap-2 lg:flex-col lg:min-w-[155px]"><template v-if="f.approval_state==='pending'"><button class="success-btn" @click="execute(()=>approveFollowUp(f.id,seller.id,seller.name,seller.role),'Reminder approved')"><Check class="w-4 h-4"/>Approve</button><button class="outline-btn" @click="studioId=f.id"><Languages class="w-4 h-4"/>Tone &amp; language</button><button class="outline-btn" @click="beginEdit(f)"><Pencil class="w-4 h-4"/>Edit</button><button class="danger-btn" @click="execute(()=>rejectFollowUp(f.id,seller.name,seller.role),'Reminder rejected')"><X class="w-4 h-4"/>Reject</button></template>
       <button v-if="f.approval_state==='approved'&&f.send_state==='not_sent'" class="primary-btn" @click="execute(()=>sendApprovedFollowUp(f.id,seller.name),'Message sent (simulated only)')"><Send class="w-4 h-4"/>Send (Simulation)</button>
       <button v-if="f.invoice" class="outline-btn" @click="openInvoice(f.invoice)"><Eye class="w-4 h-4"/>View Invoice</button></div></div></div>
 </section>
 <section v-if="tab==='all'||tab==='responses'" class="space-y-3"><h3 class="text-sm font-semibold">Customer Responses</h3><p v-if="!responses.length" class="card p-6 text-sm text-orbyte-muted">No customer responses yet.</p>
  <CustomerReplyCard v-for="r in responses" :key="r.id" :response="r" :invoice="r.invoice" :customer-name="r.customer?.name" :seller-name="seller.name" @review-invoice="openInvoice"/>
 </section>
 <AttentionQueue v-if="tab==='all'||tab==='exceptions'" @review="reviewAttention"/>
 <section v-if="tab==='all'||tab==='blocked'" class="space-y-3" aria-label="Blocked orders"><h3 class="text-sm font-semibold">Blocked orders</h3>
  <p class="text-xs text-orbyte-muted">These orders cannot be invoiced or followed up until someone acts. Reminders stay paused.</p>
  <p v-if="!blocked.length" class="card p-6 text-sm text-orbyte-muted">No blocked orders. Every order can move to its next step.</p>
  <article v-for="b in blocked" :key="b.order.id" class="card flex flex-col gap-3 border-l-4 border-l-rose-500 p-4 sm:flex-row sm:items-center sm:justify-between">
   <div class="min-w-0 space-y-1.5"><p class="text-sm font-semibold">{{custMap.get(b.order.customer_id)?.name||'Customer'}} · {{b.order.reference}}</p>
    <div v-for="(x,i) in b.blockers" :key="i" class="text-sm"><p class="flex items-start gap-1.5 text-rose-800"><AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />{{x.reason}}</p>
     <p class="pl-5 text-xs text-orbyte-muted"><span class="font-medium text-slate-700">Owner: {{x.owner}}</span> · Next: {{x.action}}<template v-if="x.evidence_id"> · <a :href="`/api/po-evidence/${x.evidence_id}`" target="_blank" rel="noopener" class="text-blue-700 underline">View evidence</a></template></p></div></div>
   <button type="button" class="primary-btn shrink-0 self-start sm:self-center" @click="router.push(`/orders/${encodeURIComponent(b.order.id)}/view`)">Open order</button>
  </article>
 </section>
 <section v-if="tab==='history'" class="card p-5"><h3 class="font-semibold mb-4">Activity History</h3><p v-if="!activity.length" class="empty-text">No activity yet.</p><div v-for="(e,k) in activity" :key="e.id" class="border-l-2 pl-4 py-2" :class="k===0?'border-orbyte-blue':'border-orbyte-border'"><p class="text-sm">{{e.description}}</p><p class="text-xs text-orbyte-muted mt-1">{{formatDateTime(e.created_at)}} · {{e.actor}} ({{e.actor_role}})</p></div></section>
 <InvoiceDetailDrawer :invoice="selected" :open="drawerOpen" :seller-name="seller.name" :seller-role="seller.role" @close="drawerOpen=false"/>
 <BaseModal :open="!!editId" title="Edit Reminder Message" @close="editId=null"><p class="text-sm text-orbyte-muted mb-3">Changing the reminder invalidates previous approval. Seller approval is required again.</p><p v-if="editError" class="text-sm text-red-600 mb-2">{{editError}}</p><textarea v-model="editText" rows="6" class="form-input"></textarea><template #footer><div class="flex justify-end gap-2"><button class="outline-btn" @click="editId=null">Cancel</button><button class="primary-btn" @click="saveEdit">Save & Reset Approval</button></div></template></BaseModal>
 <ToneStudio :open="!!studioId" :follow-up-id="studioId" :facts="studioFacts" :current-message="studioFollowUp?.message ?? ''" :default-tone="stageTone(studioFollowUp?.checkpoint ?? 2)" :saved-lang="customerLang(studioFollowUp?.customer)" @close="studioId=null" @apply="applyStudio" />
</div>
</template>
