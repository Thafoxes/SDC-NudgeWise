import { supplierFromCompany } from './companyProfile';
import type { Customer, OrderBlocker, PurchaseOrder, PurchaseOrderDetails } from '@/types';
import { getStore, update, DEMO_BUSINESS_ID, computeInvoiceWithCustomer } from './store';
import { validatePurchaseOrderDetails, purchaseOrderTotal } from './purchaseOrder';

type Result = { success: boolean; error?: string; id?: string };
export interface CustomerInput { name: string; phone: string; email: string; address?: string }
export interface CustomerExtraction { name: string | null; phone: string | null; email: string | null; address: string | null }

export function normalizePhone(value: string): string {
  if (typeof value !== 'string' || value.length > 50 || !/^[+\d\s().-]+$/.test(value)) throw new Error('Enter a valid phone number');
  let phone = value.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  // shortcut: national numbers use Malaysia; require +country code for other countries.
  if (/^0[1-9]\d{7,9}$/.test(phone)) phone = '+60' + phone.slice(1);
  else if (/^60[1-9]\d{7,9}$/.test(phone)) phone = '+' + phone;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error('Use a Malaysian phone number or include +country code');
  return phone;
}

export function lookupCustomersByPhone(phone: string, businessId = DEMO_BUSINESS_ID): Customer[] {
  const normalized = normalizePhone(phone);
  return getStore().customers.filter(c => {
    if (c.business_id !== businessId || !c.phone) return false;
    try { return normalizePhone(c.phone) === normalized; } catch { return false; }
  });
}

function permittedActor(name: string, role: string, businessId: string): boolean {
  // shortcut: existing demo identities only; authenticate the server principal before real business use.
  return ['seller', 'staff'].includes(role) && getStore().users.some(u => u.name === name && u.role === role && u.business_id === businessId);
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

export function createCustomer(input: CustomerInput, actorName: string, actorRole: string, businessId = DEMO_BUSINESS_ID): Result {
  if (!permittedActor(actorName, actorRole, businessId)) return { success: false, error: 'Seller or staff authorization required' };
  if (!input || !boundedText(input.name, 120) || !input.name.trim()
    || !boundedText(input.email, 254) || (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    || (input.address !== undefined && !boundedText(input.address, 500)))
    return { success: false, error: 'Check customer name, email and address' };
  let phone: string;
  try { phone = normalizePhone(input.phone); } catch (error) { return { success: false, error: (error as Error).message }; }
  if (lookupCustomersByPhone(phone, businessId).length) return { success: false, error: 'This phone already belongs to a customer. Select the existing record.' };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  update(data => {
    data.customers.push({ id, business_id: businessId, name: input.name.trim(), phone, email: input.email.trim() || null,
      address: input.address?.trim() || null, telegram_chat_id: null });
    data.activityEvents.unshift({ id: crypto.randomUUID(), business_id: businessId, invoice_id: null, event_type: 'customer_created',
      actor: actorName, actor_role: actorRole, description: `Customer ${input.name.trim()} created after phone check`, metadata: { customer_id: id }, created_at: now });
  });
  return { success: true, id };
}

/** Safe demo maintenance: only unreferenced draft orders may be removed. */
export function deletePurchaseOrder(orderId: string, actorName: string, actorRole: string, businessId = DEMO_BUSINESS_ID): Result {
  if (!permittedActor(actorName, actorRole, businessId)) return { success:false, error:'Seller or staff authorization required' };
  const data = getStore();
  const order = data.purchaseOrders.find(o => o.id === orderId && o.business_id === businessId);
  if (!order) return { success:false, error:'PO not found' };
  if (order.status !== 'draft') return { success:false, error:'Only draft POs can be deleted. Keep approved orders for history.' };
  if (data.invoices.some(i => i.purchase_order_id === orderId) || data.quotations.some(q => q.purchase_order_id === orderId))
    return { success:false, error:'This PO has quotations or invoices. It cannot be deleted.' };
  // Preserve evidence and workflow history rather than silently orphaning it.
  const linked = ['orderEvidence','deliveryConfirmations','orderCases','paymentClaims','settlementReceipts','creditNotes','debitNotes'] as const;
  if (linked.some(key => (data as unknown as Record<string, any[]>)[key]?.some(item => item.purchase_order_id === orderId)))
    return { success:false, error:'This PO has supporting records. Resolve or archive it instead.' };
  update(state => { state.purchaseOrders = state.purchaseOrders.filter(o => o.id !== orderId);
    state.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:null,event_type:'purchase_order_deleted', actor:actorName, actor_role:actorRole,description:`Draft PO ${order.reference} deleted`,metadata:{order_id:orderId},created_at:new Date().toISOString()}); });
  return { success:true };
}

export function updateCustomer(customerId: string, input: CustomerInput, actorName: string, actorRole: string, businessId = DEMO_BUSINESS_ID): Result {
  if (!permittedActor(actorName,actorRole,businessId)) return {success:false,error:'Seller or staff authorization required'};
  const current=getStore().customers.find(c=>c.id===customerId&&c.business_id===businessId);
  if(!current) return {success:false,error:'Customer not found'};
  if(!input || !boundedText(input.name,120) || !input.name.trim() || !boundedText(input.email,254) || (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) || (input.address!==undefined && !boundedText(input.address,500))) return {success:false,error:'Check name, email and address'};
  let phone:string;
  try {phone=normalizePhone(input.phone);} catch(e){return {success:false,error:(e as Error).message};}
  if(lookupCustomersByPhone(phone,businessId).some(c=>c.id!==customerId)) return {success:false,error:'Phone number belongs to another customer'};
  update(data=>{const c=data.customers.find(x=>x.id===customerId)!;c.name=input.name.trim();c.phone=phone;c.email=input.email.trim()||null;c.address=input.address?.trim()||null;
    data.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:null,event_type:'customer_updated',actor:actorName,actor_role:actorRole,description:`Customer ${c.name} updated`,metadata:{customer_id:customerId},created_at:new Date().toISOString()});});
  return {success:true,id:customerId};
}

export function deleteCustomer(customerId:string, actorName:string, actorRole:string,businessId=DEMO_BUSINESS_ID):Result {
  if(!permittedActor(actorName,actorRole,businessId))return {success:false,error:'Seller or staff authorization required'};
  const data=getStore(); const c=data.customers.find(c=>c.id===customerId&&c.business_id===businessId);
  if(!c)return {success:false,error:'Customer not found'};
  if(Object.values(data).some(value=>Array.isArray(value)&&value.some(item=>item && typeof item==='object' && 'customer_id' in item && item.customer_id===customerId && item!==c)))return {success:false,error:'Customer has business history. Deletion is blocked; preserve the records.'};
  update(state=>{state.customers=state.customers.filter(x=>x.id!==customerId);state.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:null,event_type:'customer_deleted',actor:actorName,actor_role:actorRole,description:`Customer ${c.name} deleted`,metadata:{customer_id:customerId},created_at:new Date().toISOString()});});
  return {success:true};
}

export function getOrderEligibility(customerId: string, businessId = DEMO_BUSINESS_ID): { allowed: boolean; blockers: OrderBlocker[] } {
  const data = getStore();
  if (!data.customers.some(c => c.id === customerId && c.business_id === businessId)) return { allowed: false, blockers: [] };
  const blockers = data.invoices.filter(i => i.customer_id === customerId && i.business_id === businessId).flatMap(invoice => {
    const balance = computeInvoiceWithCustomer(invoice, data, data.demoState.simulated_date).outstanding_balance;
    const reason = invoice.dispute_active ? 'Active invoice dispute'
      : invoice.settlement_required && balance > 0 ? 'Previously disputed invoice requires settlement'
      : invoice.settlement_required && invoice.verification_hold ? 'Settlement verification requires review' : '';
    return reason ? [{ invoice_id: invoice.id, invoice_number: invoice.invoice_number, balance, reason }] : [];
  });
  return { allowed: blockers.length === 0, blockers };
}

export function createPurchaseOrder(customerId: string, reference: string, actorName: string, actorRole: string, businessId = DEMO_BUSINESS_ID, details?: PurchaseOrderDetails, sourceMode: 'manual'|'chat_screenshot'|'uploaded_po' = 'manual'): Result {
  if (!permittedActor(actorName, actorRole, businessId)) return { success: false, error: 'Seller or staff authorization required' };
  if (!getStore().customers.some(c => c.id === customerId && c.business_id === businessId)) return { success: false, error: 'Customer not found for this business' };
  if (!boundedText(reference, 100) || !reference.trim()) return { success: false, error: 'Enter a PO reference (up to 100 characters)' };
  if (getStore().purchaseOrders.some(o => o.business_id === businessId && o.customer_id === customerId && o.reference.toLowerCase() === reference.trim().toLowerCase()))
    return { success: false, error: 'This customer already has an order with this PO reference' };
  let confirmed: PurchaseOrderDetails | undefined;
  try { if (details !== undefined) confirmed = validatePurchaseOrderDetails(details); } catch (error) { return { success: false, error: (error as Error).message }; }
  const id = crypto.randomUUID();
  if (!['manual','chat_screenshot','uploaded_po'].includes(sourceMode)) return { success: false, error: 'Invalid order source mode' };
  if(confirmed && sourceMode!=='uploaded_po')Object.assign(confirmed,supplierFromCompany(getStore().businesses.find(b=>b.id===businessId)));
  const now = new Date().toISOString();
  update(data => {
    data.purchaseOrders.unshift({ id, business_id: businessId, customer_id: customerId, reference: reference.trim(), status: 'draft', source_mode: sourceMode, created_at: now, ...(confirmed ? { details: confirmed } : {}) });
    data.activityEvents.unshift({ id: crypto.randomUUID(), business_id: businessId, invoice_id: null, event_type: 'purchase_order_received',
      actor: actorName, actor_role: actorRole, description: `Buyer PO ${reference.trim()} recorded; processing approval pending`, metadata: { order_id: id, customer_id: customerId }, created_at: now });
  });
  return { success: true, id };
}

export function updatePurchaseOrder(orderId: string, reference: string, details: PurchaseOrderDetails, actorName: string, actorRole: string, businessId = DEMO_BUSINESS_ID): Result {
  if (!permittedActor(actorName, actorRole, businessId)) return { success: false, error: 'Seller or staff authorization required' };
  const order = getStore().purchaseOrders.find(o => o.id === orderId && o.business_id === businessId);
  if (!order || order.status !== 'draft') return { success: false, error: 'Only a draft PO in this business can be edited' };
  if (!boundedText(reference, 100) || !reference.trim()) return { success: false, error: 'Enter a PO reference' };
  if (getStore().purchaseOrders.some(o => o.id !== orderId && o.business_id === businessId && o.customer_id === order.customer_id && o.reference.toLowerCase() === reference.trim().toLowerCase())) return { success: false, error: 'Duplicate PO reference for this customer' };
  let confirmed: PurchaseOrderDetails;
  try { confirmed = validatePurchaseOrderDetails(details); } catch (error) { return { success: false, error: (error as Error).message }; }
  if(order.source_mode!=='uploaded_po')Object.assign(confirmed,supplierFromCompany(getStore().businesses.find(b=>b.id===businessId)));
  const accepted = getStore().quotations.find(q=>q.purchase_order_id===orderId && q.status==='accepted');
  if (accepted && (JSON.stringify(confirmed.items)!==JSON.stringify(accepted.items) || confirmed.currency!==accepted.currency || confirmed.payment_terms!==accepted.payment_terms))
    return {success:false,error:'Items, prices and terms must match the accepted quotation. You can correct the optional document total without changing the agreement.'};
  update(data => {
    Object.assign(data.purchaseOrders.find(o => o.id === orderId)!, { reference: reference.trim(), details: confirmed });
    data.activityEvents.unshift({ id: crypto.randomUUID(), business_id: businessId, invoice_id: null, event_type: 'purchase_order_updated', actor: actorName, actor_role: actorRole,
      description: `PO ${reference.trim()} details updated`, metadata: { order_id: orderId, customer_id: order.customer_id }, created_at: new Date().toISOString() });
  });
  return { success: true, id: orderId };
}

export function approvePurchaseOrder(orderId: string, actorName: string, actorRole: string, businessId = DEMO_BUSINESS_ID, overrideReason?: string): Result {
  if (actorRole !== 'seller' || !permittedActor(actorName, actorRole, businessId)) return { success: false, error: 'Only the seller can approve or override an order' };
  const order = getStore().purchaseOrders.find(o => o.id === orderId && o.business_id === businessId);
  if (!order) return { success: false, error: 'Order not found for this business' };
  if (order.status !== 'draft') return { success: false, error: 'This order has already been approved' };
  const calculatedTotal = order.details ? purchaseOrderTotal(order.details.items) : null;
  const totalMismatch = !!order.details?.items.length && order.details.document_total !== null
    && (calculatedTotal === null || Math.round(calculatedTotal * 100) !== Math.round(order.details.document_total * 100));
  if (!getStore().customers.some(c => c.id === order.customer_id && c.business_id === businessId)) return { success: false, error: 'Order customer no longer exists in this business' };
  const eligibility = getOrderEligibility(order.customer_id, businessId);
  const needsOverride = !eligibility.allowed || totalMismatch;
  if (needsOverride && (!boundedText(overrideReason, 500) || !overrideReason.trim()))
    return { success: false, error: totalMismatch ? 'The line items do not match the printed total. Correct the details or enter a seller override reason for this order.' : 'Order on hold. Seller must enter a reason to override for this order.' };
  const now = new Date().toISOString();
  const override: PurchaseOrder['override'] = !needsOverride ? undefined : {
    reason: overrideReason!.trim(), actor: actorName, approved_at: now, blockers: eligibility.blockers,
    ...(totalMismatch ? { total_mismatch: { calculated: calculatedTotal, printed: order.details!.document_total! } } : {}),
  };
  update(data => {
    const current = data.purchaseOrders.find(o => o.id === orderId && o.business_id === businessId)!;
    Object.assign(current, { status: 'approved', approved_by: actorName, approved_at: now, ...(override ? { override } : {}) });
    data.activityEvents.unshift({ id: crypto.randomUUID(), business_id: businessId, invoice_id: null,
      event_type: override ? 'purchase_order_override' : 'purchase_order_approved', actor: actorName, actor_role: actorRole,
      description: `PO ${order.reference} approved${override ? ' with a one-order exception' : ''}`,
      metadata: { order_id: orderId, customer_id: order.customer_id, ...(override ? { override } : {}) }, created_at: now });
  });
  return { success: true, id: orderId };
}
