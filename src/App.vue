<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterView } from 'vue-router';
import AppSidebar from '@/components/AppSidebar.vue';
import AppHeader from '@/components/AppHeader.vue';
import DemoControls from '@/components/DemoControls.vue';
import PaymentCelebration from '@/components/PaymentCelebration.vue';
import { useDemoStore } from '@/composables/useDemoStore';
import { DEMO_BUSINESS_ID, DEMO_SELLER_ID } from '@/lib/store';
import { backendEnabled, connectionError, refreshServer } from '@/services/commands';
const {data,refreshStore}=useDemoStore();
const mainContent=ref<HTMLElement|null>(null);
const seller=computed(()=>data.value.users.find(u=>u.id===DEMO_SELLER_ID)??data.value.users[0]);
const notifications=computed(()=>data.value.notifications.filter(n=>n.business_id===DEMO_BUSINESS_ID));
const onStorage=()=>refreshStore();
onMounted(()=>window.addEventListener('storage',onStorage));
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(()=>{if(backendEnabled){void refreshServer().catch(()=>{});poll=setInterval(()=>void refreshServer().catch(()=>{}),2000);}});
onUnmounted(()=>{if(poll)clearInterval(poll);});
onUnmounted(()=>window.removeEventListener('storage',onStorage));
</script>
<template>
  <div class="min-h-screen bg-orbyte-bg text-orbyte-ink">
    <a class="skip-link" href="#main-content" @click.prevent="mainContent?.focus()">Skip to content</a>
    <AppSidebar />
    <div class="lg:pl-[240px]">
      <AppHeader :notifications="notifications" :simulated-date="data.demoState.simulated_date" :seller-name="seller.name" :seller-role="seller.role" :avatar-color="seller.avatar_color" />
      <main id="main-content" ref="mainContent" tabindex="-1" class="mx-auto max-w-[1600px] px-4 py-6 pb-24 lg:px-8"><p v-if="connectionError" role="alert" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{connectionError}}</p><RouterView /></main>
      <DemoControls :seller-name="seller.name" />
      <PaymentCelebration :business-id="DEMO_BUSINESS_ID" />
    </div>
  </div>
</template>
