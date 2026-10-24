<script setup lang="ts">
import { Send } from 'lucide-vue-next';
defineProps<{ message: string; recipientName?: string; senderName?: string }>();
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-slate-200">
    <div class="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
      <span class="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
        <Send class="h-3 w-3 text-sky-500" /> Message preview
        <span v-if="recipientName" class="font-normal text-slate-400">· to {{ recipientName }}</span>
      </span>
      <span class="text-[12px] text-slate-400">Simulated delivery</span>
    </div>
    <div class="bg-[#E7EEF5] px-3 py-3">
      <div class="ml-auto max-w-[92%] rounded-xl rounded-br-sm bg-[#EFFDDE] px-3 py-2 shadow-sm sm:max-w-[85%]">
        <p v-if="senderName" class="mb-0.5 text-[13px] font-semibold text-sky-700">{{ senderName }}</p>
        <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{{ message }}</p>
        <p class="mt-1 text-right text-[12px] text-slate-400">Preview only</p>
      </div>
    </div>
  </div>
</template>
