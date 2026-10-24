<script setup lang="ts">
import {ref} from 'vue';
const props=defineProps<{kind:'po'|'quotation'|'invoice'|'receipt';recordId:string}>();
type Draft={kind:string;id:string;to:string;subject:string;body:string;filename:string;reference:string};
const draft=ref<Draft|null>(null),approved=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const mode=ref<'send_only'|'await_reply'>(['po','quotation'].includes(props.kind)?'await_reply':'send_only');
async function api(url:string,body:object){const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NudgeWise-Local':'1'},body:JSON.stringify(body)});const output=await response.json();if(!response.ok)throw Error(output.error||`HTTP ${response.status}`);return output.result;}
async function prepare(){busy.value=true;error.value='';notice.value='';approved.value=false;try{draft.value=await api('/api/email/compose',{kind:props.kind,id:props.recordId,mode:mode.value});}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function changeMode(){if(draft.value)draft.value=null;approved.value=false;notice.value='Mode changed. Open the email composer to regenerate the appropriate message.';}
async function send(){if(!approved.value||!draft.value)return;busy.value=true;error.value='';try{await api('/api/email/send',{...draft.value,mode:mode.value,confirmed:true});notice.value='Gmail accepted the email. Recipient delivery is not guaranteed.';draft.value=null;approved.value=false;}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
</script>
<template>
 <section class="space-y-2">
  <label class="block text-xs font-medium">Email mode<select v-model="mode" class="form-input" :disabled="busy" @change="changeMode"><option value="send_only">Send Only</option><option value="await_reply">Send &amp; Wait for Reply</option></select></label>
  <p class="text-xs text-slate-500">{{mode==='await_reply'?'Requires Gmail read access and enabled reply monitoring. Replies are matched and suggested for seller review.':'Email is sent and recorded without creating a buyer-approval wait.'}}</p>
  <button type="button" class="outline-btn" :disabled="busy" @click="draft?draft=null:prepare()">{{draft?'Cancel Email':`Email ${kind==='po'?'PO':kind==='quotation'?'Quotation':kind==='invoice'?'Invoice':'Receipt'} PDF`}}</button>
  <div v-if="draft" class="rounded-lg border bg-slate-50 p-3 space-y-3 text-sm">
   <p class="font-semibold">Seller approval · {{draft.filename}}</p>
   <label class="block">Buyer email<input class="form-input" type="email" v-model.trim="draft.to" required /></label>
   <label class="block">Subject<input class="form-input" v-model="draft.subject" maxlength="170" /></label>
   <label class="block">Message<textarea class="form-input" v-model="draft.body" rows="5" maxlength="6000" /></label>
   <label class="flex items-start gap-2"><input type="checkbox" v-model="approved" class="mt-1" /><span>I verified the document, recipient and message, and authorize this one email.</span></label>
   <button type="button" class="primary-btn" :disabled="busy||!approved" @click="send">{{busy?'Sending…':'Approve & Send with Gmail'}}</button>
  </div>
  <p v-if="error" role="alert" class="text-xs text-rose-700">{{error}}</p>
  <p v-if="notice" role="status" class="text-xs text-emerald-700">{{notice}}</p>
 </section>
</template>
