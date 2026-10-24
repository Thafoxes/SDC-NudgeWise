<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import AssistantMarkdown from '@/components/AssistantMarkdown.vue';
import KnowledgePolicies from '@/components/KnowledgePolicies.vue';
import { Sparkles, Bot, User, Send, Trash2, AlertCircle } from 'lucide-vue-next';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID } from '@/lib/store';
import { askAiAssistant, addAiMessage, clearAiConversation, backendEnabled, connectionError, integration } from '@/services/commands';
import { useDemoStore } from '@/composables/useDemoStore';
import { formatDateTime } from '@/lib/format';
const {data,refreshStore}=useDemoStore();
const input=ref(''),loading=ref(false),scrollArea=ref<HTMLElement|null>(null);
const aiError=ref(''),selectedInvoice=ref('');
const invoices=computed(()=>data.value.invoices.filter(i=>i.business_id===DEMO_BUSINESS_ID));
const messages=computed(()=>data.value.aiConversations.filter(m=>m.business_id===DEMO_BUSINESS_ID));
function conversationalReply(message:string):string|null {
 const text=message.trim().toLowerCase().replace(/[.!?\s]+$/g,'');
 if(/^(hi|hello|hey|hey there|good morning|good afternoon|good evening)$/.test(text))return 'Hello! I can help with your orders, quotations, invoices and payment follow-ups. What would you like to do?';
 if(/^(bye|goodbye|see you|see ya)$/.test(text))return 'See you! Come back whenever you need help with an order or payment.';
 if(/^(thanks|thank you|thank you so much|thx)$/.test(text))return 'You’re welcome! Anything else you’d like to check?';
 return null;
}
const prompts=['What is the difference between a PO and quotation?','Which purchase orders are pending?','Which invoices need attention and what policy applies?','Explain common payment blockers.','What evidence supports an order?','How does a payment claim get verified?'];
async function scrollDown(){await nextTick();if(scrollArea.value)scrollArea.value.scrollTop=scrollArea.value.scrollHeight;}
async function send(text:string){
 const question=text.trim();if(!question||loading.value)return;
 loading.value=true;input.value='';aiError.value='';
 try {
  await addAiMessage(DEMO_BUSINESS_ID,DEMO_SELLER_ID,'user',question);refreshStore();void scrollDown();
  const casual=conversationalReply(question);
  if(casual) await addAiMessage(DEMO_BUSINESS_ID,DEMO_SELLER_ID,'assistant',casual,[]);
  else {
   const res=await askAiAssistant(question,DEMO_BUSINESS_ID,data.value.businesses.find(b=>b.id===DEMO_BUSINESS_ID)?.name || 'My business',selectedInvoice.value);
   await addAiMessage(DEMO_BUSINESS_ID,DEMO_SELLER_ID,'assistant',res.answer,res.sources||[]);
  }
 } catch (cause) { aiError.value = cause instanceof Error ? cause.message : 'AI request failed'; }
 finally {loading.value=false;refreshStore();void scrollDown();}
}
async function clear(){await clearAiConversation(DEMO_BUSINESS_ID);refreshStore();}
function onKeydown(e:KeyboardEvent){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(input.value);}}
</script>
<template>
 <div class="flex flex-col gap-4" style="min-height:calc(100vh - 160px)"><KnowledgePolicies/><label class="text-sm">Invoice context (optional)<select v-model="selectedInvoice" class="form-input"><option value="">All current invoices</option><option v-for="i in invoices" :key="i.id" :value="i.id">{{i.invoice_number}}</option></select></label><div class="card flex flex-1 flex-col overflow-hidden">
 <div ref="scrollArea" class="flex-1 overflow-y-auto space-y-4 px-5 py-6" style="min-height:330px; max-height:65vh">
   <div v-if="!messages.length&&!loading" class="flex flex-col items-center justify-center py-10 text-center"><div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orbyte-blue to-orbyte-button text-white mb-4"><Sparkles class="w-7 h-7"/></div><h3 class="text-lg font-semibold">NudgeWise AI Assistant</h3><p class="text-sm text-orbyte-muted mt-1 max-w-md">Ask about orders, quotations, invoices, payments and general topics. {{backendEnabled?`AI mode: ${integration.aiMode}; model: ${integration.model}. Business-specific answers use available records; AI cannot approve or change them.`:'Browser-only mode cannot access an AI model. Enable and start the backend for real AI.'}}</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-lg w-full"><button v-for="p in prompts" :key="p" class="rounded-xl border border-orbyte-border bg-orbyte-bg/30 px-4 py-3 text-left text-sm hover:bg-orbyte-bg hover:border-orbyte-blue" @click="send(p)">{{p}}</button></div></div>
   <div v-for="m in messages" :key="m.id" class="flex gap-3" :class="m.role==='user'?'flex-row-reverse':''"><div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orbyte-button text-white"><User v-if="m.role==='user'" class="w-4 h-4"/><Bot v-else class="w-4 h-4"/></div><div class="flex min-w-0 max-w-[90%] sm:max-w-[80%] flex-col gap-1" :class="m.role==='user'?'items-end':''"><AssistantMarkdown v-if="m.role==='assistant'" :content="m.content"/><p v-else class="rounded-2xl rounded-tr-sm bg-orbyte-button px-4 py-2.5 text-sm whitespace-pre-wrap text-white break-words">{{m.content}}</p><details v-if="m.sources?.length" class="text-xs"><summary class="cursor-pointer text-blue-700">Retrieved sources</summary><a v-for="s in m.sources" :key="s.id" :href="s.url" class="block text-blue-700 underline">{{s.title}} [{{s.id}}]</a></details><span class="text-[10px] text-orbyte-muted">{{formatDateTime(m.created_at)}}</span></div></div>
   <div v-if="loading" class="flex gap-3"><div class="rounded-full bg-orbyte-button p-2 text-white"><Bot class="w-4 h-4"/></div><p class="rounded-xl bg-orbyte-bg p-3 text-sm text-orbyte-muted">{{backendEnabled?'Asking configured AI…':'Preparing demo answer…'}}</p></div>
 </div>
 <p v-if="aiError" role="alert" class="px-5 py-2 text-sm text-rose-700 bg-rose-50">{{ aiError }}</p>
 <div class="flex items-center gap-2 border-t border-orbyte-border bg-amber-50/70 px-5 py-2"><AlertCircle class="w-4 h-4 text-amber-600 shrink-0"/><p class="text-xs text-amber-700">{{!backendEnabled?'Browser-only mode: responses use predefined invoice rules.':connectionError ? `Backend error: ${connectionError}` : `AI mode: ${integration.aiMode} · Model: ${integration.model}. A successful reply confirms API access; configured does not mean connected.`}}</p></div>
 <div class="border-t border-orbyte-border p-4"><div class="flex items-end gap-2"><textarea aria-label="Ask NudgeWise AI" v-model="input" @keydown="onKeydown" rows="1" placeholder="Ask NudgeWise AI anything..." class="form-input !mt-0 resize-none flex-1"/><button class="primary-btn" :disabled="!input.trim()||loading" @click="send(input)"><Send class="w-4 h-4"/>Send</button><button v-if="messages.length" class="outline-btn" @click="clear"><Trash2 class="w-4 h-4"/>Clear</button></div></div>
 </div></div>
</template>
