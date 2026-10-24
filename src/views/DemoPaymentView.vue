<script setup lang="ts">
import {computed} from 'vue';
import {useRoute} from 'vue-router';
const route=useRoute();
const reference=computed(()=>typeof route.query.reference==='string'?route.query.reference.slice(0,100):'-');
const amount=computed(()=>{const value=Number(route.query.amount);return Number.isFinite(value)&&value>0?value.toFixed(2):'-';});
const currency=computed(()=>typeof route.query.currency==='string'&&/^[A-Z]{3}$/.test(route.query.currency)?route.query.currency:'-');
</script>
<template>
 <section class="card mx-auto max-w-lg p-6 space-y-4"><p class="text-sm font-bold text-amber-700">DEMO ONLY - NO REAL PAYMENT</p><h2 class="text-xl font-semibold">Payment link preview</h2><dl class="space-y-2"><div><dt class="text-sm text-slate-500">Invoice reference</dt><dd>{{reference}}</dd></div><div><dt class="text-sm text-slate-500">Amount shown in the link</dt><dd class="text-lg font-bold">{{currency}} {{amount}}</dd></div></dl><p class="text-sm">This demonstration does not collect card or bank details, charge money, or change an invoice's payment status.</p><p class="text-xs text-slate-500">Link values are illustrative and can be edited. They are not a verified invoice balance or proof of payment. Ask the seller for real payment instructions.</p></section>
</template>
