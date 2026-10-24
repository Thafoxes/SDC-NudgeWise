<script setup lang="ts">
import { onMounted, ref } from 'vue';
type Overview={
 gmail:{connected:boolean;autoRemindersEnabled:boolean;automationLiveEnabled?:boolean;incomingEnabled?:boolean;canRead?:boolean};
 documentAutomation:{invoice:boolean;receipt:boolean};
 lastSync:string|null;
};
const state=ref<Overview|null>(null),busy=ref(false),error=ref(''),notice=ref('');
async function request(url:string,body?:object){const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-NudgeWise-Local':'1'}:undefined,body:body?JSON.stringify(body):undefined});const output=await response.json();if(!response.ok)throw Error(output.error||`HTTP ${response.status}`);return output.result??output;}
async function load(){try{state.value=await request('/api/email/overview');}catch(cause){error.value=(cause as Error).message;}}
async function call(url:string,body:object={},message='Updated'){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{const result=await request(url,body);await load();notice.value=typeof result?.imported==='number'?`Imported ${result.imported} new buyer replies.`:message;}catch(cause){error.value=(cause as Error).message;}finally{busy.value=false;}}
function setLive(value:boolean){if(value&&!confirm('Start sending REAL payment reminder emails automatically from your connected Gmail account? Eligible unpaid invoices may be emailed when their reminder dates are due.'))return;void call('/api/email/settings',{automationLiveEnabled:value,confirmActivation:value},value?'Live automatic emails activated.':'Live sending paused.');}
function setDocumentAuto(kind:'invoice'|'receipt',enabled:boolean){
 if(enabled&&!confirm(`Automatically email every NEW ${kind==='invoice'?'issued invoice':'seller-confirmed final receipt'} PDF from your connected Gmail account to the customer's saved email address? This applies only to documents issued AFTER activation. Customers must prefer email.`))return;
 void call('/api/email/document-automation',{kind,enabled,confirmed:enabled},enabled?'Future '+kind+' emails enabled.':'Automatic '+kind+' emails disabled.');
}
function setIncoming(value:boolean){void call('/api/email/settings',{incomingEnabled:value},value?'Incoming monitoring enabled.':'Incoming monitoring disabled.');}
onMounted(()=>void load());
</script>
<template>
 <section class="card p-5 sm:p-6 space-y-5">
  <header><h2 class="font-semibold text-base">Email Automation & Buyer Replies</h2><p class="text-sm text-slate-600 mt-1">Routine emails require an explicitly enabled Gmail account. All buyer replies are suggestions requiring seller review.</p></header>
  <div v-if="!state" class="text-sm text-slate-500">Email communication service unavailable or loading.</div>
  <template v-else>
   <div class="rounded-lg border p-3 space-y-2">
    <h3 class="font-semibold text-sm">Live Payment Reminders</h3>
    <p class="text-xs text-amber-800">Safety check: both the reminder preference above and this LIVE switch must be ON before real reminders can be sent. You can turn either OFF to stop future scheduled sends.</p>
    <label class="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" :checked="!!state.gmail.automationLiveEnabled" :disabled="busy||!state.gmail.connected||!state.gmail.autoRemindersEnabled" @change="setLive(($event.target as HTMLInputElement).checked)" /> Enable LIVE scheduled email delivery</label>
    <p class="text-xs text-slate-600">A running backend checks invoices about every 15 minutes. Only eligible invoices are emailed at 3 days before due and after 7/14 days overdue. Day-21 generates a seller review task.</p>
   </div>
   <div class="rounded-lg border p-3 space-y-2">
    <h3 class="font-semibold text-sm">Automatic Invoice & Receipt Emails</h3>
    <p class="text-xs text-slate-600">PO and quotation emails stay manual. For invoices and receipts, seller issuance/confirmation authorizes sending only if its checkbox is enabled. These options are independent of payment-reminder automation.</p>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="!!state.documentAutomation.invoice" :disabled="busy||!state.gmail.connected" @change="setDocumentAuto('invoice',($event.target as HTMLInputElement).checked)" /> Automatically email NEW invoices after seller issuance</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="!!state.documentAutomation.receipt" :disabled="busy||!state.gmail.connected" @change="setDocumentAuto('receipt',($event.target as HTMLInputElement).checked)" /> Automatically email NEW final receipts after seller confirmation</label>
    <p class="text-xs text-amber-800">Both are OFF by default. Enabling does not email old records. Documents are checked about every 30 seconds while the backend runs. If Gmail fails or sending is uncertain, NudgeWise creates a seller-review task instead of retrying automatically.</p>
   </div>
   <div class="rounded-lg border p-3 space-y-2">
    <h3 class="font-semibold text-sm">Incoming Buyer Replies</h3>
    <p class="text-xs text-slate-600">Only known NudgeWise Gmail threads are read. To enable, add <code>gmail.readonly</code> in Google Cloud, set <code>GMAIL_ENABLE_REPLY_SCOPE=true</code> on the backend, and reconnect Gmail.</p>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="!!state.gmail.incomingEnabled" :disabled="busy||!state.gmail.canRead" @change="setIncoming(($event.target as HTMLInputElement).checked)" /> Monitor buyer replies to tracked emails</label>
    <p v-if="!state.gmail.canRead" class="text-xs text-amber-800">Read access not granted. Gmail sending remains available.</p>
    <div class="flex items-center gap-2 flex-wrap"><button type="button" class="outline-btn" :disabled="busy||!state.gmail.incomingEnabled" @click="call('/api/email/sync',{},'Checked known email threads.')">Check Replies Now</button><span class="text-xs text-slate-500">Last check: {{state.lastSync||'Never'}}</span></div>
   </div>
  </template>
  <p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p><p v-if="notice" role="status" class="text-sm text-emerald-700">{{notice}}</p>
 </section>
</template>
