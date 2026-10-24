<script setup lang="ts">
import {computed,ref} from 'vue';
import {RouterLink} from 'vue-router';
import {useDemoStore} from '@/composables/useDemoStore';
import {DEMO_BUSINESS_ID} from '@/lib/store';
import {formatMYR} from '@/lib/format';
const {data}=useDemoStore();
const search=ref('');
const quotations=computed(()=>data.value.quotations.filter(q=>q.business_id===DEMO_BUSINESS_ID).map(q=>{
 const order=data.value.purchaseOrders.find(o=>o.id===q.purchase_order_id);
 const customer=data.value.customers.find(c=>c.id===order?.customer_id);
 return {q,order,customer};
}).filter(x=>[x.q.reference,x.order?.reference,x.customer?.name].some(v=>(v||'').toLowerCase().includes(search.value.toLowerCase()))));
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-lg font-semibold">Quotations</h2><RouterLink class="primary-btn" to="/orders">Open orders to create a quotation</RouterLink></div>
  <section class="card overflow-hidden"><div class="p-4 border-b"><input v-model="search" class="form-input !mt-0 max-w-sm" type="search" aria-label="Search quotations" placeholder="Search quotation, order or customer..." /></div>
  <div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-50 text-left"><tr><th class="p-3">Quotation</th><th class="p-3">Order</th><th class="p-3">Customer</th><th class="p-3">Amount</th><th class="p-3">Buyer decision</th><th class="p-3">Action</th></tr></thead>
   <tbody><tr v-for="{q,order,customer} in quotations" :key="q.id" class="border-t"><td class="p-3 font-medium">{{q.reference}}</td><td class="p-3">{{order?.reference||'—'}}</td><td class="p-3">{{customer?.name||'—'}}</td><td class="p-3">{{formatMYR(q.amount,q.currency)}}</td><td class="p-3 capitalize">{{q.status.replace(/_/g,' ')}}</td><td class="p-3"><RouterLink v-if="order" class="text-blue-700 underline" :to="{path:`/orders/${order.id}/view`,query:{stage:'quotation'}}">View quotation</RouterLink></td></tr><tr v-if="!quotations.length"><td colspan="6" class="p-4 text-slate-500">No quotations found.</td></tr></tbody></table></div></section>
 </div>
</template>
