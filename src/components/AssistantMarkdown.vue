<script setup lang="ts">
import { computed } from 'vue';
import { renderAssistantMarkdown } from '@/presentation/assistantMarkdown';
const props = defineProps<{ content: string }>();
const html = computed(() => renderAssistantMarkdown(props.content));
</script>

<template>
 <div class="assistant-markdown min-w-0 overflow-x-auto rounded-2xl rounded-tl-sm bg-orbyte-bg px-4 py-3 text-sm text-orbyte-ink" v-html="html" />
</template>

<style scoped>
.assistant-markdown { overflow-wrap: anywhere; line-height: 1.65; }
.assistant-markdown :deep(> :first-child) { margin-top: 0; }
.assistant-markdown :deep(> :last-child) { margin-bottom: 0; }
.assistant-markdown :deep(p), .assistant-markdown :deep(ul), .assistant-markdown :deep(ol), .assistant-markdown :deep(pre), .assistant-markdown :deep(blockquote), .assistant-markdown :deep(table) { margin: .65rem 0; }
.assistant-markdown :deep(h1), .assistant-markdown :deep(h2), .assistant-markdown :deep(h3), .assistant-markdown :deep(h4), .assistant-markdown :deep(h5), .assistant-markdown :deep(h6) { margin: 1rem 0 .4rem; font-weight: 700; line-height: 1.35; }
.assistant-markdown :deep(h1) { font-size: 1.25rem; }
.assistant-markdown :deep(h2) { font-size: 1.1rem; }
.assistant-markdown :deep(ul) { list-style: disc; padding-left: 1.4rem; }
.assistant-markdown :deep(ol) { list-style: decimal; padding-left: 1.4rem; }
.assistant-markdown :deep(li) { margin: .25rem 0; }
.assistant-markdown :deep(a) { color: #1d4ed8; text-decoration: underline; }
.assistant-markdown :deep(code) { background: #e2e8f0; border-radius: .25rem; padding: .1rem .25rem; font-size: .85em; }
.assistant-markdown :deep(pre) { overflow-x: auto; border-radius: .5rem; background: #0f172a; color: #f1f5f9; padding: .75rem; white-space: pre; }
.assistant-markdown :deep(pre code) { padding: 0; background: transparent; color: inherit; }
.assistant-markdown :deep(blockquote) { border-left: 3px solid #94a3b8; padding-left: .75rem; color: #475569; }
.assistant-markdown :deep(table) { border-collapse: collapse; min-width: 100%; }
.assistant-markdown :deep(th), .assistant-markdown :deep(td) { border: 1px solid #cbd5e1; padding: .45rem .65rem; text-align: left; }
.assistant-markdown :deep(th) { background: #e2e8f0; font-weight: 600; }
.assistant-markdown :deep(hr) { margin: 1rem 0; border-color: #cbd5e1; }
</style>
