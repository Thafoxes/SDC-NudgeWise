<script setup lang="ts">
import { computed, ref } from 'vue';
import { Bell, ChevronDown } from 'lucide-vue-next';
import { useRouter, useRoute } from 'vue-router';
import type { Notification } from '@/types';
import { formatDateTime } from '@/lib/format';
import { markNotificationReadById } from '@/services/commands';
import { useDemoStore } from '@/composables/useDemoStore';
const props=defineProps<{notifications:Notification[]; simulatedDate:string; sellerName:string; sellerRole:string; avatarColor:string}>();
const {refreshStore}=useDemoStore(); const route=useRoute(); const router=useRouter();
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
