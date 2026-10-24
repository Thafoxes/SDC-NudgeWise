<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { LayoutDashboard, Zap, Sparkles, Menu, X, FileText, Users, ClipboardList, Settings, ChevronDown, ListFilter, ReceiptText, FileCheck2 } from 'lucide-vue-next';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID } from '@/lib/store';
const { data } = useDemoStore();
const route = useRoute();
const business = computed(() => data.value.businesses.find(b => b.id === DEMO_BUSINESS_ID));
const seller = computed(() => data.value.users.find(u => u.id === DEMO_SELLER_ID));
const mobileOpen = ref(false);
const ordersOpen = ref(route.path.startsWith('/orders') || route.path==='/invoices');
watch(()=>route.path, path => { if (path.startsWith('/orders') || path==='/invoices') ordersOpen.value=true; });
const links = [
 {to:'/dashboard',label:'Dashboard',icon:LayoutDashboard},
 {to:'/customers',label:'Customers',icon:Users},
 {to:'/action-center',label:'Action Center',icon:Zap},
 {to:'/ai-assistant',label:'AI Assistant',icon:Sparkles},
 {to:'/settings',label:'Settings',icon:Settings},
];
const sublinks = [
 {to:'/orders',label:'All Orders',icon:ListFilter},
 {to:'/orders?type=po',label:'Purchase Orders',icon:ClipboardList},
 {to:'/orders/quotations',label:'Quotations',icon:FileCheck2},
 {to:'/orders/invoices',label:'Invoices',icon:FileText},
 {to:'/orders?type=direct',label:'Direct Orders',icon:ReceiptText},
];
const isSubActive = (to:string) => {
 const [path, query] = to.split('?');
 if(route.path!==path)return false;
 const type = route.query.type;
 return query ? type===new URLSearchParams(query).get('type') : (path==='/orders' ? !type : true);
};
</script>
<template>
 <button type="button" aria-label="Open navigation" class="fixed top-3 left-3 z-40 rounded-lg bg-white p-2 shadow-sm border border-orbyte-border lg:hidden" @click="mobileOpen=true"><Menu class="w-5 h-5" /></button>
 <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-[#162A50]/30 lg:hidden" @click="mobileOpen=false"></div>
 <aside class="fixed left-0 top-0 z-40 h-full w-[240px] flex flex-col border-r border-orbyte-border bg-orbyte-sidebar transition-transform duration-200" :class="mobileOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'">
  <div class="flex items-center justify-between px-5 pt-6 pb-4"><div><h1 class="text-lg font-bold tracking-tight">NudgeWise</h1><p class="text-xs text-orbyte-muted mt-1">Order-to-Payment Assistant</p></div><button class="lg:hidden" aria-label="Close navigation" @click="mobileOpen=false"><X class="w-5 h-5" /></button></div>
  <div class="mx-3 rounded-lg border border-orbyte-border bg-slate-50 p-3"><p class="text-sm font-semibold">{{business?.name}}</p><p class="mt-1 text-xs text-orbyte-muted">{{seller?.name}} · Seller demo</p></div>
  <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
   <RouterLink :to="'/dashboard'" @click="mobileOpen=false" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium" :class="route.path==='/dashboard'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'"><LayoutDashboard class="w-[18px] h-[18px]" />Dashboard</RouterLink>
   <button type="button" class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium" :class="route.path.startsWith('/orders')?'text-blue-700 bg-blue-50':'text-slate-600 hover:bg-slate-50'" :aria-expanded="ordersOpen" aria-controls="orders-menu" @click="ordersOpen=!ordersOpen">
    <span class="flex items-center gap-3"><ClipboardList class="w-[18px] h-[18px]" />Orders</span><ChevronDown class="h-4 w-4 transition-transform" :class="ordersOpen?'rotate-180':''" />
   </button>
   <div v-if="ordersOpen" id="orders-menu" class="ml-4 space-y-0.5 border-l-2 border-blue-100 pl-2">
    <RouterLink v-for="item in sublinks" :key="item.to" :to="item.to" @click="mobileOpen=false" class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium" :class="isSubActive(item.to)?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'"><component :is="item.icon" class="h-4 w-4 shrink-0" />{{item.label}}</RouterLink>
   </div>
   <RouterLink v-for="link in links.filter(x=>x.to!=='/dashboard')" :key="link.to" :to="link.to" @click="mobileOpen=false" class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition" :class="route.path===link.to?'bg-blue-50 text-blue-700 font-semibold':'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"><component :is="link.icon" class="h-[18px] w-[18px]" />{{link.label}}</RouterLink>
  </nav>
 </aside>
</template>
