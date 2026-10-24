<script setup lang="ts">
import {computed,reactive,ref,watch} from 'vue';
import {useRoute} from 'vue-router';
import {useDemoStore} from '@/composables/useDemoStore';
import {DEMO_BUSINESS_ID,DEMO_SELLER_ID} from '@/lib/store';
import {saveKnowledgePolicy,extractPolicyDocument,backendEnabled} from '@/services/commands';
import type {KnowledgePolicy} from '@/lib/knowledge';
import guide from '../../docs/customer-order-workflow.md?raw';
const {data,refreshStore}=useDemoStore();const route=useRoute();
const policies=computed(()=>(data.value.knowledgePolicies||[]).filter(p=>p.business_id===DEMO_BUSINESS_ID));
const seller=computed(()=>data.value.users.find(u=>u.id===DEMO_SELLER_ID));
const open=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const form=reactive({id:'',title:'',version:'1',effective_date:data.value.demoState.simulated_date,active:true,text:'',evidence_id:'',reviewed:false});
function edit(p?:KnowledgePolicy){Object.assign(form,{id:p?.id||'',title:p?.title||'',version:p?.version||'1',effective_date:p?.effective_date||data.value.demoState.simulated_date,
 active:p?.active??true,text:p?.text||'',evidence_id:p?.evidence_id||'',reviewed:false});open.value=true;error.value='';notice.value='';}
watch(()=>route.query.policy,id=>{const p=policies.value.find(p=>p.id===id);if(p)edit(p);},{immediate:true});
async function upload(event:Event){
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
 busy.value=true;error.value='';form.reviewed=false;
 try{
  if(/\.(txt|md)$/i.test(file.name)){if(file.size>40000)throw Error('Choose a text file up to 40 KB');form.text=await file.text();form.evidence_id='';}
  else{const result=await extractPolicyDocument(file,seller.value?.role);form.text=result.extracted_text||'';form.evidence_id=result.evidence.id;
   if(!form.text)error.value='OCR could not read this document. The original is retained; enter policy text manually and review it.';}
  if(!form.title)form.title=file.name.replace(/\.[^.]+$/,'');
 }catch(e){error.value=e instanceof Error?e.message:'Upload failed';}finally{busy.value=false;(event.target as HTMLInputElement).value='';}
}
async function save(){if(!seller.value||busy.value)return;busy.value=true;error.value='';try{
 const input={...form,...(!form.id?{id:undefined}:{}),...(!form.evidence_id?{evidence_id:undefined}:{})};
 const result=await saveKnowledgePolicy(input,seller.value.name,seller.value.role,DEMO_BUSINESS_ID);form.id=result.id;refreshStore();form.reviewed=false;notice.value='Reviewed policy saved. Retrieval uses active policies effective on the business date.';
 }catch(e){error.value=e instanceof Error?e.message:'Save failed';}finally{busy.value=false;}}
</script>
<template>
 <section class="card p-4 space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold">Company policies and assistant sources</h2><p class="text-xs text-orbyte-muted">Reviewed policies guide suggestions; they do not change application approval rules.</p></div><button class="outline-btn" @click="edit()">Add policy</button></div>
  <p class="text-xs text-orbyte-muted">Cloud mode sends retrieved passages and selected business facts to Ollama. PDF OCR runs locally. Maximum policy text: 40,000 characters.</p>
  <ul class="space-y-1"><li v-for="p in policies" :key="p.id"><button class="text-sm text-blue-700 underline" @click="edit(p)">{{p.title}} · v{{p.version}} · {{p.active?'Active':'Inactive'}} · effective {{p.effective_date}}</button></li></ul>
  <form v-if="open" class="space-y-3 border-t pt-3" @submit.prevent="save" @input="if(($event.target as HTMLInputElement).name!=='reviewed')form.reviewed=false;notice=''">
   <fieldset :disabled="busy||seller?.role!=='seller'" class="space-y-3">
    <label class="block text-sm">Title<input v-model="form.title" required maxlength="160" class="form-input" /></label>
    <div class="grid grid-cols-2 gap-3"><label class="text-sm">Version<input v-model="form.version" required maxlength="40" class="form-input" /></label><label class="text-sm">Effective date<input v-model="form.effective_date" required type="date" class="form-input" /></label></div>
    <label class="block text-sm">Read PDF or text file<input type="file" accept=".pdf,.txt,.md" :disabled="busy" class="block mt-1 text-xs" @change="upload" /></label>
    <p v-if="!backendEnabled" class="text-xs">PDF extraction requires the backend. Text entry and text-file import work locally.</p>
    <a v-if="form.evidence_id&&backendEnabled" :href="`/api/po-evidence/${form.evidence_id}`" target="_blank" rel="noopener" class="text-sm text-blue-700 underline">View original policy PDF</a>
    <label class="block text-sm">Reviewed policy text<textarea v-model="form.text" required maxlength="40000" rows="7" class="form-input" /></label>
    <label class="flex gap-2 text-sm"><input v-model="form.active" type="checkbox" />Active (saving deactivates other versions with the same title)</label>
   </fieldset>
   <label class="flex gap-2 text-sm"><input v-model="form.reviewed" name="reviewed" type="checkbox" :disabled="busy" />I reviewed the text, version and effective date.</label>
   <p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p><p v-if="notice" role="status" class="text-sm text-green-700">{{notice}}</p>
   <div class="flex gap-2"><button class="primary-btn" :disabled="busy||!form.reviewed||seller?.role!=='seller'">{{busy?'Processing…':'Save reviewed policy'}}</button><button type="button" class="outline-btn" @click="open=false">Close</button></div>
  </form>
  <details :open="route.query.guide==='1'"><summary class="cursor-pointer text-sm text-blue-700">Read workflow manual used by the assistant</summary><pre class="mt-3 whitespace-pre-wrap text-xs max-h-96 overflow-y-auto">{{guide}}</pre></details>
 </section>
</template>
