/**
 * NudgeWise v1.1 — deterministic, explainable CUSTOMER follow-up priorities.
 * Not a credit score or prediction; never authorises sending a reminder.
 */
import type { Customer, Invoice, Payment, Credit } from '@/types';
import { DEMO_BUSINESS_ID, getStore, debitTotal } from './store';
import { daysOverdue, toCents } from './format';

export type PriorityLevel = 'red' | 'yellow' | 'green' | 'grey';
export interface SettledEvidence {
  invoiceId: string;
  invoiceNumber: string;
  dueDate: string;
  settledDate: string;
  daysLate: number;
  late: boolean;
}
export interface CustomerPriority {
  businessId: string;
  customerId: string;
  customerName: string;
  level: PriorityLevel;
  label: string;
  reason: string;
  reviewFlags: string[];
  supportingInvoiceIds: string[];
  lastFiveSettled: SettledEvidence[];
  settledCount: number;
  lateCount: number;
  calculatedAt: string;
  ruleVersion: '1.1';
}

/** Calculate settlement date from recorded ledger events, not the `paid` label. */
function settlementDate(inv: Invoice, payments: Payment[], credits: Credit[], today: string, debits = 0): string | null {
  const events = [
    ...payments.filter(p => p.invoice_id === inv.id && p.business_id === inv.business_id && p.verification_status === 'recorded' && p.payment_date <= today)
      .map(p => ({ date: p.payment_date, cents: toCents(p.amount) })),
    ...credits.filter(c => c.invoice_id === inv.id && c.business_id === inv.business_id && c.created_at.slice(0, 10) <= today)
      .map(c => ({ date: c.created_at.slice(0, 10), cents: toCents(c.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let total = 0;
  for (const event of events) {
    total += event.cents;
    if (total >= toCents(inv.invoice_amount) + toCents(debits)) return event.date;
  }
  return null;
}

export function calculateCustomerPriorities(
  businessId: string = DEMO_BUSINESS_ID,
  today?: string,
  data: ReturnType<typeof getStore> = getStore(),
): CustomerPriority[] {
  const currentDate = today ?? data.demoState.simulated_date;
  const customers = data.customers.filter(c => c.business_id === businessId);
  const invoices = data.invoices.filter(i => i.business_id === businessId);
  return customers.map((customer: Customer) => {
    const own = invoices.filter(i => i.customer_id === customer.id);
    const held = own.filter(i => i.dispute_active || i.verification_hold);
    const valid = own.filter(i => !i.dispute_active && !i.verification_hold);
    const flags = held.map(i => `${i.invoice_number}: ${i.dispute_active ? 'dispute' : 'payment verification'} requires review; excluded from adverse classification`);
    const unsettled = valid.map(inv => {
      const settled = settlementDate(inv, data.payments, data.credits, currentDate, debitTotal(data, inv));
      return { inv, settled };
    }).filter(record => !record.settled);
    const overdue = unsettled.filter(({ inv }) => daysOverdue(inv.due_date, currentDate) > 0);
    const redInvoices = overdue.filter(({ inv }) => daysOverdue(inv.due_date, currentDate) >= 14);
    const missedPromises = unsettled.filter(({ inv }) => inv.promise_confirmed && !!inv.promise_to_pay_date && inv.promise_to_pay_date < currentDate);
    const yellowInvoices = overdue.filter(({ inv }) => daysOverdue(inv.due_date, currentDate) >= 1 && daysOverdue(inv.due_date, currentDate) <= 13);

    const lastFiveSettled: SettledEvidence[] = valid.flatMap(inv => {
      const settledDate = settlementDate(inv, data.payments, data.credits, currentDate, debitTotal(data, inv));
      return settledDate ? [{
        invoiceId: inv.id, invoiceNumber: inv.invoice_number, dueDate: inv.due_date,
        settledDate, daysLate: daysOverdue(inv.due_date, settledDate), late: settledDate > inv.due_date,
      }] : [];
    }).sort((a, b) => b.settledDate.localeCompare(a.settledDate) || b.invoiceId.localeCompare(a.invoiceId)).slice(0, 5);
    const lateCount = lastFiveSettled.filter(item => item.late).length;
    let level: PriorityLevel = 'grey';
    let reason: string;
    let supportingInvoiceIds: string[] = [];
    if (redInvoices.length || missedPromises.length) {
      level = 'red';
      reason = missedPromises.length
        ? `Missed confirmed payment promise on ${missedPromises.map(x => x.inv.invoice_number).join(', ')}.`
        : `${redInvoices.length} undisputed invoice(s) at least 14 days overdue.`;
      supportingInvoiceIds = [...new Set([...redInvoices, ...missedPromises].map(x => x.inv.id))];
    } else if (yellowInvoices.length || (lateCount >= 2)) {
      level = 'yellow';
      reason = yellowInvoices.length
        ? `${yellowInvoices.length} undisputed invoice(s) 1–13 days overdue.`
        : `${lateCount} of the last 5 eligible settled invoices were paid late.`;
      supportingInvoiceIds = yellowInvoices.length
        ? yellowInvoices.map(x => x.inv.id) : lastFiveSettled.filter(x => x.late).map(x => x.invoiceId);
    } else if (lastFiveSettled.length >= 5 && lateCount <= 1) {
      level = 'green';
      reason = `${lateCount} of the last 5 eligible settled invoices were late; no undisputed overdue balance.`;
      supportingInvoiceIds = lastFiveSettled.map(x => x.invoiceId);
    } else {
      level = 'grey';
      reason = `${lastFiveSettled.length} eligible settled invoice(s); 5 required for history-based classification.`;
      supportingInvoiceIds = lastFiveSettled.map(x => x.invoiceId);
      if (held.length) flags.push('History incomplete after excluding disputed/verification-held invoices.');
    }
    return {
      businessId, customerId: customer.id, customerName: customer.name, level,
      label: { red: 'Needs attention', yellow: 'Follow-up due', green: 'Routine monitoring', grey: 'Insufficient history' }[level],
      reason, reviewFlags: flags, supportingInvoiceIds, lastFiveSettled,
      settledCount: lastFiveSettled.length, lateCount, calculatedAt: `${currentDate} (simulated date)`, ruleVersion: '1.1',
    };
  });
}
