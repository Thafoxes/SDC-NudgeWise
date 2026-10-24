import type { PurchaseOrderDetails, PurchaseOrderItem } from '@/types';
import { validDate } from './replyAnalysis';

export function emptyPurchaseOrderDetails(): PurchaseOrderDetails {
  return { order_date: '', delivery_date: '', currency: '', buyer_name: '', buyer_address: '', buyer_phone: '', buyer_email: '',
    supplier_name: '', supplier_address: '', supplier_phone: '', supplier_email: '', delivery_address: '', delivery_phone: '',
    attention: '', payment_terms: '', requested_by: '', document_approved_by: '', department: '', document_status: '', notes: '',
    items: [], document_total: null };
}

export function purchaseOrderLineTotal(item: PurchaseOrderItem): number | null {
  if (![item.quantity, item.unit_price, item.discount].every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  return Math.round(item.quantity! * item.unit_price! * 100) / 100 - Math.round(item.discount! * 100) / 100;
}

export function purchaseOrderTotal(items: PurchaseOrderItem[]): number | null {
  const totals = items.map(purchaseOrderLineTotal);
  return totals.some(n => n === null) ? null : totals.reduce<number>((sum, n) => sum + Math.round(n! * 100), 0) / 100;
}

export function validatePurchaseOrderDetails(value: unknown): PurchaseOrderDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid PO details');
  const input = value as Record<string, unknown>;
  const result = emptyPurchaseOrderDetails();
  for (const key of Object.keys(result).filter(k => !['items', 'document_total'].includes(k))) {
    const field = input[key];
    const max = ['notes', 'buyer_address', 'supplier_address', 'delivery_address'].includes(key) ? 2000 : 254;
    if (typeof field !== 'string' || field.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(field)) throw new Error(`Check PO field: ${key.replace(/_/g, ' ')}`);
    (result as unknown as Record<string, unknown>)[key] = field.trim();
  }
  for (const key of ['order_date', 'delivery_date'] as const) if (result[key] && !validDate(result[key])) throw new Error('Check the PO and delivery dates');
  if (result.currency && !/^[A-Z]{3}$/.test(result.currency)) throw new Error('Use a three-letter currency code, such as MYR or USD');
  if (!Array.isArray(input.items) || input.items.length > 100) throw new Error('PO must have at most 100 line items');
  result.items = input.items.map((item: PurchaseOrderItem) => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 240 || /[\u0000-\u001f\u007f]/.test(item.name)
      || typeof item.code !== 'string' || item.code.length > 100 || /[\u0000-\u001f\u007f]/.test(item.code)) throw new Error('Each item needs a description and a valid item code');
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1e9
      || Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-5
      || (item.unit_price !== null && (typeof item.unit_price !== 'number' || !Number.isFinite(item.unit_price) || item.unit_price < 0 || Math.abs(item.unit_price*100-Math.round(item.unit_price*100)) > 1e-5))
      || (item.discount !== null && (typeof item.discount !== 'number' || !Number.isFinite(item.discount) || item.discount < 0 || Math.abs(item.discount*100-Math.round(item.discount*100)) > 1e-5))
      || (item.unit_price !== null && item.discount !== null && purchaseOrderLineTotal(item)! < 0))
      throw new Error('Check item quantity, price and discount; missing prices are allowed on draft orders only');
    return { name: item.name.trim(), code: item.code.trim(), quantity: item.quantity, unit_price: item.unit_price, discount: item.discount };
  });
  if (result.items.length && !result.currency) throw new Error('Confirm the currency before saving line items');
  if (input.document_total !== null && (typeof input.document_total !== 'number' || input.document_total < 0
    || !Number.isSafeInteger(Math.round(input.document_total * 100)) || Math.abs(input.document_total * 100 - Math.round(input.document_total * 100)) > 1e-5)) throw new Error('Check the printed order total');
  result.document_total = input.document_total as number | null;
  if (input.evidence_id !== undefined) {
    if (typeof input.evidence_id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.evidence_id)) throw new Error('Invalid PO evidence reference');
    result.evidence_id = input.evidence_id;
  }
  const total = purchaseOrderTotal(result.items);
  if (total !== null && !Number.isSafeInteger(Math.round(total * 100))) throw new Error('PO total exceeds supported limits');
  return result;
}
