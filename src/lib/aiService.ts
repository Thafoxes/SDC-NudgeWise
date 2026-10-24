// AI service — local simulation, no external AI API
import {
  InvoiceWithCustomer,
} from '@/types';
import { getStore, computeInvoiceWithCustomer, DEMO_BUSINESS_ID, DEMO_BUSINESS_NAME } from './store';
import { resolvePromiseDate } from './replyAnalysis';
import { formatMYR, formatDate, sumMoney } from './format';

export const AI_CATEGORIES = [
  'payment_already_made_claim',
  'payment_promise',
  'payment_promise_or_extension_request',
  'invoice_dispute',
  'general_response',
  'unclear_requires_review',
] as const;

export interface AiClassification {
  category: string;
  confidence: number;
  extracted_date: string | null;
  suggested_action: string;
  used_fallback: boolean;
}

export function classifyCustomerResponse(message: string, sentAt: string = new Date().toISOString(), timezone: string = 'Asia/Kuala_Lumpur'): AiClassification {
  const lower = message.toLowerCase();

  if (lower.includes('already paid') || lower.includes('sudah bayar') || lower.includes('paid yesterday') || lower.includes('made payment') || lower.includes('transfer sudah')) {
    return { category: 'payment_already_made_claim', confidence: 0.85, extracted_date: null, suggested_action: 'Pause reminders and request payment verification. Do not mark as paid.', used_fallback: true };
  }
  if (lower.includes('dispute') || lower.includes('never received') || lower.includes('tidak terima') || lower.includes('wrong') || lower.includes('not delivered') || lower.includes('defective')) {
    return { category: 'invoice_dispute', confidence: 0.85, extracted_date: null, suggested_action: 'Pause reminders. Create exception. Notify seller to investigate.', used_fallback: true };
  }
  const dateMatch = extractDate(lower, sentAt, timezone);
  if (lower.includes('will pay') || lower.includes('can i pay') || lower.includes('next friday') || lower.includes('next week') || lower.includes('pay tomorrow') || lower.includes('bayar esok') || lower.includes('extension') || lower.includes('pay by')) {
    const category = lower.includes('can i') || lower.includes('extension') || lower.includes('request') ? 'payment_promise_or_extension_request' : 'payment_promise';
    return {
      category, confidence: 0.80, extracted_date: dateMatch,
      suggested_action: category === 'payment_promise_or_extension_request'
        ? 'Extract proposed date. Request seller confirmation. Do not change terms automatically.'
        : 'Extract proposed payment date. Request seller confirmation before recording it.',
      used_fallback: true,
    };
  }
  if (lower.includes('okay') || lower.includes('noted') || lower.includes('understood') || lower.includes('will check')) {
    return { category: 'general_response', confidence: 0.70, extracted_date: null, suggested_action: 'No action required. Log as general acknowledgement.', used_fallback: true };
  }
  return { category: 'unclear_requires_review', confidence: 0.40, extracted_date: null, suggested_action: 'Message is unclear. Flag for seller manual review.', used_fallback: true };
}

function extractDate(lower: string, sentAt: string, timezone: string): string | null {
  const phrase = lower.match(/(?:the )?end of (?:the |this )?(?:day|week)|next week|(?:next |this )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|tonight|today|esok|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{4})?/i)?.[0] || null;
  return resolvePromiseDate(phrase, sentAt, timezone).date;
}

export function getSuggestedAction(category: string): string {
  switch (category) {
    case 'payment_already_made_claim': return 'Pause reminders and request payment verification. Do not mark as paid.';
    case 'payment_promise': return 'Extract proposed payment date. Request seller confirmation before recording it.';
    case 'payment_promise_or_extension_request': return 'Extract proposed date. Request seller confirmation. Do not change terms automatically.';
    case 'invoice_dispute': return 'Pause reminders. Create exception. Notify seller to investigate.';
    case 'general_response': return 'No action required. Log as general acknowledgement.';
    case 'unclear_requires_review': return 'Message is unclear. Flag for seller manual review.';
    default: return 'Review required.';
  }
}

export function askAiAssistant(question: string, businessId: string = DEMO_BUSINESS_ID, businessName: string = DEMO_BUSINESS_NAME, invoiceId = ''): { answer: string; usedFallback: boolean; sources?: import('./knowledge').RagSource[] } {
  const data = getStore();
  const todayStr = data.demoState.simulated_date;
  const invoices = data.invoices
    .filter((i) => i.business_id === businessId)
    .map((i) => computeInvoiceWithCustomer(i, data, todayStr));

  return { answer: deterministicAnswer(question, invoices, businessName), usedFallback: true };
}

function deterministicAnswer(question: string, invoices: InvoiceWithCustomer[], businessName: string): string {
  const lower = question.toLowerCase();
  const overdue = invoices.filter((i) => i.status === 'overdue');
  const pending = invoices.filter((i) => i.status === 'pending');
  const paid = invoices.filter((i) => i.status === 'paid');
  const totalOutstanding = sumMoney(invoices.map((i) => i.outstanding_balance));
  const totalOverdue = sumMoney(overdue.map((i) => i.outstanding_balance));

  if (lower.includes('overdue')) {
    if (overdue.length === 0) return 'You have no overdue invoices right now.';
    const lines = overdue.map((i) => `• ${i.invoice_number} — ${i.customer?.name} — ${formatMYR(i.outstanding_balance)} — ${i.days_overdue} days overdue`);
    return `You have ${overdue.length} overdue invoice(s) totalling ${formatMYR(totalOverdue)}:\n\n${lines.join('\n')}`;
  }
  if (lower.includes('owe') || lower.includes('most money') || lower.includes('biggest')) {
    const sorted = [...invoices].filter((i) => i.outstanding_balance > 0).sort((a, b) => b.outstanding_balance - a.outstanding_balance);
    const top = sorted.slice(0, 5);
    const lines = top.map((i) => `• ${i.customer?.name} — ${i.invoice_number} — ${formatMYR(i.outstanding_balance)}`);
    return `Your top outstanding balances:\n\n${lines.join('\n')}\n\nTotal outstanding across all invoices: ${formatMYR(totalOutstanding)}`;
  }
  if (lower.includes('follow-up today') || lower.includes('need follow') || lower.includes('attention')) {
    const need = overdue.filter((i) => !i.dispute_active && !i.verification_hold).slice(0, 5);
    if (need.length === 0) return 'No invoices require follow-up today.';
    const lines = need.map((i) => `• ${i.invoice_number} — ${i.customer?.name} — ${formatMYR(i.outstanding_balance)} — ${i.days_overdue} days overdue`);
    return `These invoices need follow-up today:\n\n${lines.join('\n')}`;
  }
  if (lower.includes('summar') && lower.includes('week')) {
    return `This week's overdue summary:\n\n• ${overdue.length} overdue invoices\n• Total overdue: ${formatMYR(totalOverdue)}\n• Total outstanding: ${formatMYR(totalOutstanding)}\n\nThe largest overdue amount is ${formatMYR(Math.max(...overdue.map((i) => i.outstanding_balance), 0))}.`;
  }
  if (lower.includes('draft') && lower.includes('reminder')) {
    const match = question.match(/INV-\d+/i);
    if (match) {
      const inv = invoices.find((i) => i.invoice_number.toLowerCase() === match[0].toLowerCase());
      if (inv) {
        return `Here is a draft reminder for ${inv.invoice_number}:\n\nDear ${inv.customer?.name}, this is a friendly reminder that invoice ${inv.invoice_number} for ${formatMYR(inv.outstanding_balance)} is currently overdue (${inv.days_overdue} days). Kindly arrange payment at your earliest convenience. If you have already paid, please share the payment reference. Thank you. — ${businessName}`;
      }
      return `I could not find invoice ${match[0]} in your records. Please check the invoice number.`;
    }
    return 'Please specify the invoice number you would like a reminder drafted for, e.g. "Draft a reminder for invoice INV-1006".';
  }
  if (lower.includes('analys') && lower.includes('response')) {
    return 'To analyse a customer response, go to the Action Center > Customer Responses tab and click "AI Analysis" on the response card. The simulated AI will classify the message and suggest a follow-up action.';
  }
  if (lower.includes('pending')) {
    return `You have ${pending.length} pending invoice(s) (not yet overdue) totalling ${formatMYR(sumMoney(pending.map((i) => i.outstanding_balance)))}.`;
  }
  if (lower.includes('paid') || lower.includes('collected')) {
    return `You have ${paid.length} fully paid invoice(s). Total collected: ${formatMYR(sumMoney(paid.map((i) => i.total_paid)))}.`;
  }
  return `I can help with invoice and payment follow-up questions. Here's a quick overview:\n\n• ${invoices.length} total invoices\n• ${overdue.length} overdue (${formatMYR(totalOverdue)})\n• ${pending.length} pending\n• ${paid.length} paid\n• Total outstanding: ${formatMYR(totalOutstanding)}\n\nTry asking: "Which invoices are overdue?", "Who owes me the most money?", or "Draft a reminder for invoice INV-1006".`;
}

export function isAiServiceConfigured(): boolean {
  return false; // Always false in demo mode — no external AI connection
}
