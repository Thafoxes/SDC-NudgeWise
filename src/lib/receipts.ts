import type { StoreData } from './store';
import { computeInvoiceWithCustomer } from './store';
import { toCents } from './format';

export interface ReceiptExtraction {
  amount: number;
  currency: string;
  payment_date: string;
  reference: string;
  beneficiary: string;
  status: string;
  invoice_number: string | null;
  transaction_count: number;
}

export interface Receipt {
  id: string;
  business_id: string;
  customer_id: string | null;
  invoice_id: string | null;
  chat_id: string;
  message_id: number;
  reply_to_message_id?: number;
  file_id: string;
  file_unique_id: string;
  hash?: string;
  extension?: string;
  status: 'processing' | 'attention' | 'recorded' | 'resolved';
  reason: string;
  extraction?: ReceiptExtraction;
  created_at: string;
  expected_account_name?: string;
}

export function receiptReason(reason: string): string {
  return reason.replace(/\bbeneficiary\b/gi, 'Recipient account name');
}

export function validateExtraction(value: unknown): ReceiptExtraction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid extraction object');
  const x = value as ReceiptExtraction;
  if (typeof x.amount !== 'number' || !Number.isFinite(x.amount) || x.amount <= 0 || !Number.isSafeInteger(toCents(x.amount)) || Math.abs(toCents(x.amount) / 100 - x.amount) > 1e-7)
    throw new Error('Invalid receipt amount');
  for (const key of ['currency', 'payment_date', 'reference', 'beneficiary', 'status'] as const)
    if (typeof x[key] !== 'string' || !x[key].trim() || x[key].length > 250) throw new Error(`Missing or invalid ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.payment_date) || !Number.isFinite(Date.parse(x.payment_date)) || new Date(x.payment_date).toISOString().slice(0, 10) !== x.payment_date)
    throw new Error('Invalid receipt date');
  if (x.invoice_number !== null && (typeof x.invoice_number !== 'string' || x.invoice_number.length > 100)) throw new Error('Invalid invoice reference');
  if (!Number.isInteger(x.transaction_count) || x.transaction_count !== 1) throw new Error('Receipt must contain exactly one transaction');
  return x;
}

export function receiptProblem(data: StoreData, invoiceId: string, x: ReceiptExtraction, beneficiary: string, today: string): string | null {
  const invoice = data.invoices.find(i => i.id === invoiceId);
  if (!invoice) return 'Invoice no longer exists';
  const business = data.businesses.find(b => b.id === invoice.business_id);
  if (invoice.dispute_active) return 'Invoice is disputed';
  if (x.currency !== business?.currency) return 'Currency does not match';
  if (x.status.toLowerCase() !== 'successful') return 'Transfer is not explicitly successful';
  if (!beneficiary || x.beneficiary.trim().toLowerCase() !== beneficiary.trim().toLowerCase()) return 'Beneficiary does not match configured seller account';
  if (x.invoice_number && x.invoice_number.toLowerCase() !== invoice.invoice_number.toLowerCase()) return 'Receipt references a different invoice';
  if (x.payment_date < invoice.issue_date || x.payment_date > today) return 'Payment date is outside the permitted range';
  const balance = computeInvoiceWithCustomer(invoice, data, today).outstanding_balance;
  if (balance <= 0) return 'Invoice is already paid';
  if (toCents(x.amount) !== toCents(balance)) return 'Payment does not equal the outstanding balance';
  if (data.payments.some(p => p.business_id === invoice.business_id && p.reference?.trim().toLowerCase() === x.reference.trim().toLowerCase())) return 'Transaction reference was already recorded';
  return null;
}
