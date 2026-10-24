<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { backendEnabled } from '@/services/commands';
type EmailStatus = {configured:boolean;connected:boolean;email:string;autoRemindersEnabled:boolean;lastTest:null|{at:string;recipient:string;messageId:string;status:string}};
const status=ref<EmailStatus|null>(null);
const to=ref(''),subject=ref('NudgeWise – Email Connection Test'),message=ref('Hello,\n\nThis is a test email from NudgeWise. Please confirm that you received it.\n\nNo action is required.');
const busy=ref(false),error=ref(''),notice=ref('');
const testMode=ref<'send_only'|'await_reply'>('send_only'),testThread=ref(''),testReply=ref(''),testDecision=ref(''),testRecipient=ref('');
async function api(endpoint:string, method='GET', payload?:object){
 const result=await fetch(endpoint,{method,credentials:'same-origin',headers: method==='POST'?{'Content-Type':'application/json','X-Nudgewise-Local':'1'}:{},body:payload?JSON.stringify(payload):undefined});
 const body=await result.json();if(!result.ok)throw Error(body.error||`Email service error (${result.status})`);return body;
}
async function refresh(){if(!backendEnabled)return;try{status.value=(await api('/api/email/status')).result;}catch(e){error.value=(e as Error).message;}}
async function run(action:()=>Promise<void>){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{await action();}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
function connect(){void run(async()=>{const body=await api('/api/email/connect','POST',{});window.location.assign(body.url);});}
function disconnect(){if(!confirm('Disconnect Gmail and disable email reminders?'))return;void run(async()=>{status.value=(await api('/api/email/disconnect','POST',{})).result;notice.value='Gmail disconnected.';});}
function saveAutomation(){void run(async()=>{status.value=(await api('/api/email/settings','POST',{autoRemindersEnabled:!status.value?.autoRemindersEnabled})).result;notice.value='Reminder preference saved. Live scheduled delivery must also be activated below and Gmail must remain connected.';});}
function sendTest(){void run(async()=>{
 if(testMode.value==='await_reply'){
  const result=(await api('/api/email/test-monitored','POST',{to:to.value,subject:subject.value,message:message.value,confirmed:true})).result;
  testThread.value=result.thread_id||'';testRecipient.value=to.value;testReply.value='';testDecision.value='';
  notice.value='Monitored test sent. Reply from your recipient account, then click Check Test Reply.';
 }else{
  const result=(await api('/api/email/test','POST',{to:to.value,subject:subject.value,message:message.value})).result;
  notice.value=`Gmail accepted the test message to ${result.recipient}. Check the recipient inbox.`;
 }await refresh();});}
async function restoreMonitoredTest(){try{
 const response=await api('/api/email/overview');
 const recent=(response.result?.history||[]).find((row:{kind:string;send_mode:string;thread_id:string})=>row.kind==='test'&&row.send_mode==='await_reply'&&row.thread_id);
 if(recent){testThread.value=recent.thread_id;testRecipient.value=recent.recipient;
  const reply=(response.result?.replies||[]).find((row:{thread_id:string})=>row.thread_id===recent.thread_id);
  if(reply){testReply.value=reply.body;testDecision.value=reply.category;}}
 }catch{ /* no monitored test available */}}
async function checkTestReply(){void run(async()=>{
 const response=await api('/api/email/sync','POST',{});
 const res=await api('/api/email/overview');
 const candidates=(res.result?.replies||[]).filter((r:{thread_id:string})=>r.thread_id===testThread.value);
 if(candidates.length){testReply.value=candidates[0].body;testDecision.value=candidates[0].category;notice.value='Test reply received and classified. No business record was changed.';}
 else notice.value=`Checked buyer replies (${response.result?.imported||0} imported); none found in this test thread yet. Verify incoming monitoring is enabled.`;
 });}

onMounted(()=>{const params=new URLSearchParams(window.location.search);if(params.has('gmail')){notice.value=params.get('gmail')==='connected'?'Gmail connected successfully. You can send a test email.':'Gmail connection failed. Try connecting again.';params.delete('gmail');window.history.replaceState({},'',window.location.pathname+(params.toString()?'?'+params:'')+window.location.hash);}void refresh();void restoreMonitoredTest();});
</script>
<template>
 <section class="card p-5 sm:p-6 space-y-5">
  <div><h2 class="text-base font-semibold text-slate-900">Email & Automation</h2><p class="mt-1 text-sm text-slate-600">Connect Gmail using Google authorization. NudgeWise never asks for your Gmail password.</p></div>
  <p v-if="!backendEnabled" class="text-sm text-amber-700">Email requires VITE_BACKEND_ENABLED=true and the running Node backend.</p>
  <template v-else>
   <div class="rounded-lg border p-4 space-y-2">
    <p class="text-sm"><strong>Connection:</strong> {{status?.connected?'🟢 Connected':status?.configured?'Not connected':'Not configured'}}</p>
    <p v-if="status?.connected" class="text-sm"><strong>Sender:</strong> {{status.email}}</p>
    <p v-if="!status?.configured" class="text-xs text-slate-600">An administrator must configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and EMAIL_TOKEN_KEY on the backend.</p>
    <div class="flex flex-wrap gap-2"><button v-if="!status?.connected" type="button" class="primary-btn" :disabled="busy||!status?.configured" @click="connect">Connect Gmail</button><template v-else><button type="button" class="primary-btn" :disabled="busy" @click="connect">Reconnect / Change Gmail</button><button type="button" class="rounded-lg border px-3 py-2 text-sm" :disabled="busy" @click="disconnect">Disconnect</button></template></div>
   </div>
   <form class="space-y-3 rounded-lg border p-4" @submit.prevent="sendTest">
    <h3 class="font-semibold">🧪 Send Test Email</h3><p class="text-xs text-slate-600">Send a clearly labeled test message from your connected Gmail account. This does not affect invoices.</p>
    <label class="block text-sm">Test email mode<select v-model="testMode" class="form-input"><option value="send_only">Send Only</option><option value="await_reply">Send &amp; Wait for Reply</option></select></label>
    <p class="text-xs text-slate-500" v-if="testMode==='await_reply'">Requires Gmail read permission and incoming monitoring. This is a test-only conversation and cannot change orders or invoices.</p>
    <label class="block text-sm">Recipient email<input v-model.trim="to" type="email" class="form-input" placeholder="your-secondary-email@example.com" maxlength="254" required /></label>
    <label class="block text-sm">Subject<input v-model="subject" class="form-input" maxlength="160" required /></label>
    <label class="block text-sm">Message<textarea v-model="message" class="form-input" rows="5" maxlength="4000" required /></label>
    <button class="primary-btn" type="submit" :disabled="busy||!status?.connected">{{busy?'Working…':'Send Test Email'}}</button>
    <div v-if="testThread" class="rounded border border-blue-200 bg-blue-50 p-3 space-y-2 text-xs"><p><strong>Monitored test:</strong> {{testRecipient}} · {{testThread}}</p><button type="button" class="outline-btn" :disabled="busy" @click="checkTestReply">Check Test Reply</button><p v-if="testReply" class="whitespace-pre-wrap">Reply: {{testReply}}</p><p v-if="testDecision">AI suggestion: {{testDecision.replace(/_/g,' ')}} (test only)</p></div>
    <p v-if="status?.lastTest" class="text-xs text-slate-600">Last accepted: {{status.lastTest.at}} → {{status.lastTest.recipient}} (provider accepted; inbox delivery not guaranteed)</p>
   </form>
   <div class="space-y-3 rounded-lg border p-4">
    <h3 class="font-semibold">Automatic Invoice Reminders</h3>
    <label class="flex gap-3 items-center text-sm"><input type="checkbox" :checked="!!status?.autoRemindersEnabled" :disabled="busy||!status?.connected" @change="saveAutomation" /> Enable automatic email reminders</label>
    <p class="text-xs text-amber-700">When checked, NudgeWise will send eligible payment reminders from your connected Gmail while the Node backend is running. Due -3 days, overdue +7/+14 days; +21 days triggers seller escalation. Paid/disputed/verification-held invoices are excluded. Switch OFF to stop future checks.</p>
   </div>
  </template>
  <p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p><p v-if="notice" role="status" class="text-sm text-emerald-700">{{notice}}</p>
 </section>
</template>
