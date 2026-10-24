<script setup lang="ts">
import { computed,reactive,ref,watch } from 'vue';
import { DEMO_COMPANY_PROFILE } from '@/lib/companyProfile';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID,DEMO_SELLER_ID } from '@/lib/store';
import { saveBusinessSettings } from '@/services/commands';
const {data,refreshStore}=useDemoStore();
const business=computed(()=>data.value.businesses.find(b=>b.id===DEMO_BUSINESS_ID));
const seller=computed(()=>data.value.users.find(u=>u.id===DEMO_SELLER_ID));
const form=reactive({name:'',address:'',phone:'',email:'',salesperson_name:'',payment_terms:'',quotation_validity_days:7});
const isDemoProfile=computed(()=>business.value?.name===DEMO_COMPANY_PROFILE.name&&business.value?.email===DEMO_COMPANY_PROFILE.email);
const busy=ref(false),dirty=ref(false),error=ref(''),notice=ref('');
function load(){const b=business.value;Object.assign(form,{name:b?.name||'',address:b?.address||'',phone:b?.phone||'',email:b?.email||'',salesperson_name:b?.salesperson_name||'',payment_terms:b?.payment_terms??'Payment within 7 days of invoice date.',quotation_validity_days:b?.quotation_validity_days||7});}
watch(business,()=>{if(!dirty.value)load();},{immediate:true});
async function save(){
 if(busy.value||!seller.value)return;
 busy.value=true;error.value='';notice.value='';
 try{
  await saveBusinessSettings({...form},seller.value.name,seller.value.role,DEMO_BUSINESS_ID);
  dirty.value=false;refreshStore();load();notice.value='Settings saved. Contact details will appear on downloaded documents.';
 }catch(cause){error.value=cause instanceof Error?cause.message:'Could not save settings.';}
 finally{busy.value=false;}
}
</script>
<template>
 <div class="mx-auto max-w-3xl space-y-5">
  <form class="card p-5 sm:p-6 space-y-5" @submit.prevent="save" @input="dirty=true;notice=''">
   <div><h2 class="text-base font-semibold text-slate-900">Supplier / seller details</h2><p class="mt-1 text-sm text-slate-600">Used on order, quotation and invoice PDFs. Optional fields print as “-” when unavailable.</p></div>
   <p v-if="isDemoProfile" class="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">This is the editable demo company profile. The address, phone and email are fictional; replace them with your own company details when needed.</p>
   <fieldset :disabled="busy" class="space-y-4">
    <label class="block text-sm font-medium">Supplier / seller name <span class="text-slate-500">(required)</span><input v-model="form.name" required maxlength="160" autocomplete="organization" class="form-input" /></label>
    <label class="block text-sm font-medium">Address<textarea v-model="form.address" maxlength="2000" rows="3" autocomplete="street-address" class="form-input" /></label>
    <div class="grid gap-4 sm:grid-cols-2"><label class="block text-sm font-medium">Phone number<input v-model="form.phone" type="tel" maxlength="40" autocomplete="tel" class="form-input" /></label><label class="block text-sm font-medium">Email <span class="text-slate-500">(optional)</span><input v-model="form.email" type="email" maxlength="254" autocomplete="email" class="form-input" /></label></div>
    <div class="border-t pt-4"><h3 class="text-sm font-semibold">Document preparation</h3><label class="mt-3 block text-sm font-medium">Salesperson / prepared by<input v-model="form.salesperson_name" maxlength="160" autocomplete="name" class="form-input" aria-describedby="prepared-by-help" /></label><p id="prepared-by-help" class="mt-2 text-xs text-slate-600">Recorded on new quotations and invoices. Leave blank to use the seller account name. Existing documents keep their recorded preparer.</p></div>
    <div class="border-t pt-4 space-y-3"><h3 class="text-sm font-semibold">Quotation defaults</h3><label class="block text-sm">Company payment terms<textarea v-model="form.payment_terms" maxlength="500" class="form-input" /></label><label class="block text-sm">Price validity (days)<input v-model.number="form.quotation_validity_days" type="number" min="1" max="365" required class="form-input" /></label><p class="text-xs text-slate-600">Applied to new quotations; review before saving. Existing quotations keep their agreed terms and expiry.</p></div>
   </fieldset>
   <p v-if="error" role="alert" class="text-sm text-rose-700">{{error}}</p><p v-if="notice" role="status" class="text-sm text-emerald-700">{{notice}}</p>
   <button type="submit" class="primary-btn" :disabled="busy||seller?.role!=='seller'">{{busy?'Saving…':'Save settings'}}</button>
  </form>
 </div>
</template>
