import { backendEnabled } from '@/services/commands';
import { templateReminder, rewriteProblem, type ReminderFacts, type Tone, type Lang } from '@/presentation/toneStudio';

export interface RewriteResult {
  text: string;
  source: 'ai' | 'template';
  note?: string;
}

/**
 * Asks Gemma (through the backend) to write the reminder in the chosen tone and
 * language. Falls back to the built-in template whenever AI is unavailable or its
 * output fails validation, so the seller can always continue.
 */
export async function rewriteReminder(followUpId: string, facts: ReminderFacts, tone: Tone, lang: Lang): Promise<RewriteResult> {
  const fallback = (note: string): RewriteResult => ({ text: templateReminder(facts, tone, lang), source: 'template', note });
  if (!backendEnabled) return fallback('AI writing is available when the backend is running');
  try {
    const response = await fetch('/api/command', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Nudgewise-Local': '1' },
      body: JSON.stringify({ name: 'rewriteReminder', args: [followUpId, tone, lang] }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return fallback(body?.error ? `AI unavailable: ${body.error}` : 'AI unavailable');
    const text = String(body?.result?.text ?? '').trim();
    const problem = rewriteProblem(text, facts);
    if (problem) return fallback(`AI draft rejected (${problem})`);
    return { text, source: 'ai' };
  } catch {
    return fallback('AI unavailable');
  }
}
