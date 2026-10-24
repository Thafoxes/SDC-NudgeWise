<script setup lang="ts">
import { computed, ref } from 'vue';
import { Bell, ChevronDown, Search } from 'lucide-vue-next';
import { useRouter, useRoute } from 'vue-router';
import type { Notification } from '@/types';
import { formatDateTime } from '@/lib/format';
import { markNotificationReadById } from '@/services/commands';
import { useDemoStore } from '@/composables/useDemoStore';
const props=defineProps<{notifications:Notification[]; simulatedDate:string; sellerName:string; sellerRole:string; avatarColor:string}>();
const {data,refreshStore}=useDemoStore(); const route=useRoute(); const router=useRouter();
const searchTerm=ref(''),searchFocused=ref(false);
const searchResults=computed(()=>{
 const q=searchTerm.value.trim().toLowerCase();if(q.length<2)return [];
 const own=data.value;
 const results:{key:string;label:string;detail:string;to:string}[]=[];
 for(const c of own.customers){if([c.name,c.email,c.phone].some(x=>String(x||'').toLowerCase().includes(q)))results.push({key:'c'+c.id,label:c.name,detail:'Customer',to:`/customers/${encodeURIComponent(c.id)}/view`});}
 for(const o of own.purchaseOrders){if([o.reference,own.customers.find(c=>c.id===o.customer_id)?.name].some(x=>String(x||'').toLowerCase().includes(q)))results.push({key:'o'+o.id,label:o.reference,detail:'Order',to:`/orders/${encodeURIComponent(o.id)}/view`});}
 for(const i of own.invoices){if([i.invoice_number,own.customers.find(c=>c.id===i.customer_id)?.name].some(x=>String(x||'').toLowerCase().includes(q)))results.push({key:'i'+i.id,label:i.invoice_number,detail:'Invoice',to:`/orders/invoices?invoice=${encodeURIComponent(i.id)}`});}
 return results.slice(0,8);
});
function goSearch(to:string){searchFocused.value=false;searchTerm.value='';void router.push(to);}
function searchEnter(){const first=searchResults.value[0];if(first)goSearch(first.to);}

const showNotifs=ref(false), showProfile=ref(false);
const unreadCount=computed(()=>props.notifications.filter(n=>!n.read).length);
const formattedDate=computed(()=>new Date(props.simulatedDate+'T12:00:00').toLocaleDateString('en-MY',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}));
async function openNotification(n:Notification){ await markNotificationReadById(n.id); refreshStore();showNotifs.value=false;if(n.link==='action-center')router.push('/action-center'); }
</script>
<template>
  <header class="sticky top-0 z-30 border-b border-orbyte-border bg-white">
    <div class="flex items-center justify-between px-6 py-3.5 lg:px-8 gap-3">
      <div class="pl-10 lg:pl-0"><div class="flex flex-wrap items-center gap-2.5"><h2 class="text-xl font-bold">{{route.meta.title}}</h2><span class="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">DEMO MODE</span></div>
        <p class="text-sm text-orbyte-muted mt-0.5">{{route.meta.subtitle}}</p><p class="text-xs text-orbyte-muted mt-0.5">{{formattedDate}}</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative hidden w-48 md:block xl:w-64">
         <label class="sr-only" for="nw-global-search">Search NudgeWise records</label>
         <Search class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
         <input id="nw-global-search" v-model="searchTerm" @focus="searchFocused=true" @blur="searchFocused=false" @keydown.enter.prevent="searchEnter" type="search" autocomplete="off" class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Search customers, PO, invoices" />
         <div v-if="searchFocused&&searchTerm.trim().length>=2" class="absolute right-0 top-full z-50 mt-1 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="listbox" aria-label="Search results">
          <button v-for="result in searchResults" :key="result.key" type="button" class="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50" @mousedown.prevent="goSearch(result.to)"><span class="font-medium">{{result.label}}</span><span class="text-xs text-slate-500">{{result.detail}}</span></button>
          <p v-if="!searchResults.length" class="px-3 py-2 text-sm text-slate-500">No matching records.</p>
         </div>
        </div>

        <div class="relative"><button aria-label="Notifications" class="relative rounded-xl p-2 text-orbyte-muted hover:bg-orbyte-bg" @click="showNotifs=!showNotifs;showProfile=false"><Bell class="w-5 h-5"/><span v-if="unreadCount" class="absolute -right-1 -top-1 rounded-full bg-orbyte-overdue px-1.5 text-[10px] text-white">{{unreadCount}}</span></button>
          <div v-if="showNotifs" class="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-xl bg-white shadow-xl border border-orbyte-border overflow-hidden"><p class="px-4 py-3 border-b border-orbyte-border text-sm font-semibold">Notifications</p><div class="max-h-80 overflow-y-auto">
            <button v-for="n in notifications" :key="n.id" @click="openNotification(n)" class="w-full px-4 py-3 text-left border-b border-orbyte-border hover:bg-orbyte-bg" :class="!n.read?'bg-blue-50/40':''"><p class="text-sm font-medium">{{n.title}} <span v-if="!n.read" class="text-orbyte-blue">•</span></p><p class="text-xs text-orbyte-muted">{{n.body}}</p><p class="text-[10px] text-orbyte-muted mt-1">{{formatDateTime(n.created_at)}}</p></button><p v-if="!notifications.length" class="p-5 text-center text-sm text-orbyte-muted">No notifications</p>
          </div></div>
        </div>
        <div class="relative"><button @click="showProfile=!showProfile;showNotifs=false" class="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-orbyte-bg"><div class="flex h-8 w-8 items-center justify-center rounded-full text-white text-sm font-semibold" :style="{backgroundColor:avatarColor}">{{sellerName.charAt(0)}}</div><span class="hidden sm:block text-left"><p class="text-sm font-medium leading-none">{{sellerName}}</p><p class="text-[10px] text-orbyte-muted mt-1 capitalize">{{sellerRole}}</p></span><ChevronDown class="hidden sm:block w-4 h-4 text-orbyte-muted" /></button>
          <div v-if="showProfile" class="absolute right-0 mt-2 w-56 rounded-xl border border-orbyte-border bg-white shadow-xl p-4"><p class="text-sm font-semibold">{{sellerName}}</p><p class="text-xs text-orbyte-muted capitalize">{{sellerRole}} account (simulated)</p></div></div>
      </div>
    </div>
  </header>
</template>
