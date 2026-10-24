import {quotationDefaults} from './businessSettings';
/** Seller-controlled PO -> quotation -> invoice -> settlement demo workflow.
 * Commands validate against server-loaded state. Uploaded evidence is NOT approval. */
import { getStore, update, computeInvoiceWithCustomer, DEMO_BUSINESS_ID } from './store';
import type { PurchaseOrderItem, PurchaseOrder } from '@/types';
import { purchaseOrderTotal, validatePurchaseOrderDetails } from './purchaseOrder';

export interface Quotation {
 id: string; business_id: string; purchase_order_id: string; reference: string; prepared_by?: string;
 items: PurchaseOrderItem[]; amount: number; currency: string; payment_terms: string;
 delivery_terms: string; valid_until: string; status: 'draft'|'sent'|'accepted'|'revision_requested'|'rejected';
 buyer_decision_note: string; buyer_decision_evidence_id: string | null; created_at: string; updated_at: string;
}
export interface OrderEvidence { id: string; business_id: string; purchase_order_id: string; filename: string; mime_type: string;
 kind: 'chat_screenshot'|'existing_po'|'buyer_approval'|'delivery_proof'|'promise_proof'|'payment_proof'|'other';
 saved_at: string; extracted_text?: string; }
export interface DeliveryConfirmation { id: string; business_id: string; purchase_order_id: string; item_name: string;
 accepted_quantity: number; reviewer_note: string; evidence_id: string | null; confirmed_at: string;
 /** Seller decided the shortfall needs no adjustment; the reason is kept. */
 shortfall_note?: string; shortfall_accepted_at?: string | null; }
/** A credit note lowers what the buyer owes. It never edits the original invoice and is not a payment. */
export interface CreditNote { id: string; business_id: string; purchase_order_id: string; invoice_id: string | null; credit_id: string | null;
 number: string; item_name: string; quantity: number; amount: number; reason: string; created_at: string; created_by: string; }
export interface PaymentClaim { id: string; business_id: string; purchase_order_id: string; invoice_id: string;
 amount: number; reference: string; evidence_id: string | null; status: 'pending'|'verified'|'rejected';
 created_at: string; reviewed_at: string | null; reviewed_by: string | null; }
export interface SettlementReceipt { id: string; business_id: string; purchase_order_id: string; invoice_id: string;
 payment_id: string; receipt_number: string; amount: number; issued_at: string; issued_by: string; }
export interface OrderCase { id: string; business_id: string; purchase_order_id: string; kind: 'dispute'|'missing_document'|'other';
 reason: string; status: 'open'|'resolved'; opened_at: string; resolved_at: string | null; resolution_note: string; }
/** A debit note raises what the buyer owes for agreed extra charges. It never edits the original invoice. */
export interface DebitNote { id: string; business_id: string; purchase_order_id: string; invoice_id: string; number: string;
 description: string; amount: number; reason: string; created_at: string; created_by: string; }
export type WorkflowData = { quotations: Quotation[]; orderEvidence: OrderEvidence[]; deliveryConfirmations: DeliveryConfirmation[];
 paymentClaims: PaymentClaim[]; settlementReceipts: SettlementReceipt[]; orderCases: OrderCase[]; creditNotes: CreditNote[]; debitNotes: DebitNote[] };
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const round2 = (n: number) => Math.round(n * 100) / 100;
function creditedQuantity(poId: string, itemName: string): number {
 return (getStore().creditNotes ?? []).filter(n => n.purchase_order_id === poId && n.item_name === itemName).reduce((sum, n) => sum + n.quantity, 0);
}
function validText(value: unknown, max = 500): value is string { return typeof value === 'string' && value.length <= max && !/[\x00-\x08\x0b-\x1f\x7f]/.test(value); }
function seller(actor: string, role: string, businessId: string) {
 const user = getStore().users.find(u => u.name === actor && u.role === role && u.business_id === businessId);
 if (!user || role !== 'seller') throw Error('Seller approval required');
}
function orderFor(id: string, business = DEMO_BUSINESS_ID): PurchaseOrder {
 const order = getStore().purchaseOrders.find(o => o.id === id && o.business_id === business);
 if (!order) throw Error('Purchase order not found');
 return order;
}
function invoiceFor(id: string, business = DEMO_BUSINESS_ID) {
 const inv = getStore().invoices.find(i => i.id === id && i.business_id === business);
 if (!inv) throw Error('Invoice not found');
 return inv;
}
function event(data: ReturnType<typeof getStore>, type: string, orderId: string, actor: string, description: string) {
 data.activityEvents.unshift({ id: id(), business_id: DEMO_BUSINESS_ID, invoice_id: null, event_type: type,
   actor, actor_role: 'seller', description, metadata: { order_id: orderId }, created_at: now() });
}
export function attachOrderEvidence(poId: string, meta: Omit<OrderEvidence, 'business_id'|'purchase_order_id'|'saved_at'>,
 actor: string, role: string, businessId = DEMO_BUSINESS_ID) {
 seller(actor, role, businessId); orderFor(poId, businessId);
 if (!/^[a-f0-9-]{36}$/.test(meta.id) || !validText(meta.filename, 255) || !validText(meta.mime_type, 80)
    || !['chat_screenshot','existing_po','buyer_approval','delivery_proof','promise_proof','payment_proof','other'].includes(meta.kind)) throw Error('Invalid evidence metadata');
 update(d => { if (d.orderEvidence.some(e => e.id === meta.id && e.purchase_order_id === poId)) return;
   d.orderEvidence.push({ ...meta, extracted_text: meta.extracted_text?.slice(0, 4000), business_id: businessId, purchase_order_id: poId, saved_at: now() });
   event(d, 'order_evidence_added', poId, actor, `Evidence attached: ${meta.kind}`);
 });
 return { success: true };
}
export function saveQuotation(poId: string, input: Pick<Quotation,'reference'|'items'|'currency'|'payment_terms'|'delivery_terms'|'valid_until'>,
 actor: string, role: string, businessId = DEMO_BUSINESS_ID) {
 seller(actor,role,businessId); const po = orderFor(poId,businessId);
 if(po.source_mode==='quick_sale')throw Error('Quick sale already has an invoice; use credit/debit notes for adjustments');
 if (!po.details?.items.length || !['draft','approved'].includes(po.status)) throw Error('Save an order with items first');
 if (!input || !validText(input.reference,80) || !input.reference.trim() || !/^[A-Z]{3}$/.test(input.currency)
   || !validText(input.payment_terms,500) || !validText(input.delivery_terms,500) || !validText(input.valid_until,10)
   || (input.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(input.valid_until))) throw Error('Check quotation details');
 input={...input,payment_terms:input.payment_terms.trim()||quotationDefaults(businessId).payment_terms,valid_until:input.valid_until||quotationDefaults(businessId).valid_until};
 const lines = validatePurchaseOrderDetails({...po.details, currency:input.currency, items:input.items, document_total:null}).items;
 if (getStore().invoices.some(i=>i.purchase_order_id===poId) || getStore().deliveryConfirmations.some(d=>d.purchase_order_id===poId))
   throw Error('Delivery or invoicing has started; preserve the agreed quotation');
 const total = purchaseOrderTotal(lines);
 if (total === null || total <= 0 || total > 1e9) throw Error('Quotation total must be positive');
 const old = getStore().quotations.find(q => q.purchase_order_id === poId && q.business_id === businessId);
 if (old?.status === 'accepted') throw Error('Accepted quotations cannot be edited; preserve buyer agreement');
 const previousQuotation = old ? structuredClone(old) : null;
 const qid = old?.id || id();
 update(d => { const q: Quotation = { id: qid, purchase_order_id: poId, business_id: businessId, reference: input.reference.trim(),
    prepared_by:old?.prepared_by||getStore().businesses.find(b=>b.id===businessId)?.salesperson_name||actor,
    currency: input.currency, items: lines, amount: total, payment_terms: input.payment_terms.trim(), delivery_terms: input.delivery_terms.trim(),
    valid_until: input.valid_until, status: 'draft', buyer_decision_note: '', buyer_decision_evidence_id: null, created_at: old?.created_at || now(), updated_at: now() };
   if (old) Object.assign(d.quotations.find(x=>x.id===qid)!,q); else d.quotations.push(q);
   event(d,'quotation_saved',poId,actor,`Quotation ${q.reference} saved as draft for seller review`);
   if (old) d.activityEvents[0].metadata = {...d.activityEvents[0].metadata, previous_quotation:previousQuotation};
 });
 return { success: true, id: qid };
}
function copyAgreedDetails(d: ReturnType<typeof getStore>, order: PurchaseOrder, q: Quotation) {
 if (order.details) {
     const savedOrder=d.purchaseOrders.find(o=>o.id===order.id)!;
     const changed=JSON.stringify(order.details.items)!==JSON.stringify(q.items) || order.details.currency!==q.currency || order.details.payment_terms!==q.payment_terms;
     savedOrder.details={...order.details,items:structuredClone(q.items),currency:q.currency,payment_terms:q.payment_terms};
     if(changed && savedOrder.status==='approved') {
       savedOrder.status='draft'; delete savedOrder.approved_by; delete savedOrder.approved_at; delete savedOrder.override;
     }
   }
}
export function copyQuotationToOrder(quotationId:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID) {
 seller(actor,role,businessId);
 const q=getStore().quotations.find(q=>q.id===quotationId && q.business_id===businessId && q.status==='accepted');
 if(!q)throw Error('An accepted quotation is required');
 const order=orderFor(q.purchase_order_id,businessId);
 if(getStore().deliveryConfirmations.some(d=>d.purchase_order_id===order.id) || getStore().invoices.some(i=>i.purchase_order_id===order.id))
   throw Error('Delivery or invoicing has started; preserve the agreed order');
 update(d=>{copyAgreedDetails(d,order,q);event(d,'quotation_copied_to_order',order.id,actor,`Agreed quotation ${q.reference} copied to order; changed processing approvals require review`);});
 return {success:true};
}
export function setQuotationDecision(quotationId: string, status: Quotation['status'], note: string,
 evidenceId: string | null, actor: string, role: string, businessId = DEMO_BUSINESS_ID) {
 seller(actor,role,businessId);
 const q = getStore().quotations.find(x => x.id === quotationId && x.business_id === businessId);
 if (!q) throw Error('Quotation not found');
 if (!['sent','accepted','revision_requested','rejected'].includes(status) || q.status === 'accepted') throw Error('Invalid quotation transition');
 if (!validText(note,1000) || (status === 'accepted' && !note.trim() && !evidenceId)) throw Error('Record how buyer acceptance was confirmed');
 if (evidenceId && !getStore().orderEvidence.some(e=>e.id===evidenceId && e.purchase_order_id===q.purchase_order_id && e.business_id===businessId)) throw Error('Confirmation evidence not linked to PO');
 const order = orderFor(q.purchase_order_id,businessId);
 if (status === 'accepted' && (getStore().invoices.some(i=>i.purchase_order_id===order.id) || getStore().deliveryConfirmations.some(d=>d.purchase_order_id===order.id)))
   throw Error('Delivery or invoicing has started; preserve the recorded order');
 update(d => { const current=d.quotations.find(x=>x.id===quotationId)!;
   Object.assign(current,{status,buyer_decision_note:note.trim(),buyer_decision_evidence_id:evidenceId,updated_at:now()});
   if (status === 'accepted') copyAgreedDetails(d,order,q);
   event(d,'quotation_decision',q.purchase_order_id,actor,`Quotation ${q.reference}: ${status} (seller recorded buyer response)${status==='accepted'?'; agreed items and terms copied to order; changed approvals require review':''}`);
 });
 return { success: true };
}
export function confirmDelivery(poId: string, itemName: string, accepted: number, note: string, evidenceId: string | null,
 actor: string,role: string,businessId=DEMO_BUSINESS_ID) {
 seller(actor,role,businessId);const po=orderFor(poId,businessId);
 const line=po.details?.items.find(i=>i.name===itemName);
 if ((po.details?.items.filter(i=>i.name===itemName).length||0)>1) throw Error('Repeated item names require individual line identification; review manually');
 if (!line || !Number.isFinite(accepted) || accepted<0 || accepted>line.quantity! || !validText(note,500) || !note.trim()) throw Error('Check accepted delivery quantity and seller note');
 if(evidenceId && !getStore().orderEvidence.some(e=>e.id===evidenceId && e.purchase_order_id===poId)) throw Error('Delivery evidence not linked');
 if(accepted+creditedQuantity(poId,itemName)>line.quantity!) throw Error('Accepted plus credited quantity cannot exceed the ordered quantity');
 update(d=>{const old=d.deliveryConfirmations.find(x=>x.purchase_order_id===poId && x.item_name===itemName);
   const entry:DeliveryConfirmation={id:old?.id||id(),business_id:businessId,purchase_order_id:poId,item_name:itemName,accepted_quantity:accepted,reviewer_note:note,evidence_id:evidenceId,confirmed_at:now(),shortfall_note:'',shortfall_accepted_at:null};
   if(old)Object.assign(old,entry);else d.deliveryConfirmations.push(entry);
   event(d,'delivery_reviewed',poId,actor,`Delivery accepted quantity for ${itemName}: ${accepted}`);
 });return {success:true};
}
export function issueOrderInvoice(poId: string, reference: string, issueDate: string, dueDate: string,
 actor: string,role:string,businessId=DEMO_BUSINESS_ID) {
 seller(actor,role,businessId);const po=orderFor(poId,businessId);
 if(po.status!=='approved')throw Error('Seller must approve PO processing before creating an invoice');
 const q=getStore().quotations.find(x=>x.purchase_order_id===poId&&x.status==='accepted'&&x.business_id===businessId);
 if(!q)throw Error('Record buyer acceptance of the quotation first');
 if(po.details?.currency!==q.currency)throw Error('Order and agreed quotation currencies differ. Review and copy the agreed quotation before invoicing.');
 if(!validText(reference,80)||!reference.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||dueDate<issueDate)throw Error('Check invoice reference and dates');
 if(getStore().invoices.some(x=>x.business_id===businessId&&x.invoice_number.toLowerCase()===reference.toLowerCase()))throw Error('Invoice number already exists');
 if(getStore().invoices.some(x=>x.purchase_order_id===poId))throw Error('This order already has an invoice; open it instead');
 const blockers=deriveOrderBlockers(poId);
 if(blockers.some(x=>x.critical))throw Error(`Resolve blocker before invoicing: ${blockers.find(x=>x.critical)!.reason}`);
 const invoiceId=id();
 update(d=>{d.invoices.unshift({id:invoiceId,business_id:businessId,customer_id:po.customer_id,purchase_order_id:poId,quotation_id:q.id,prepared_by:getStore().businesses.find(b=>b.id===businessId)?.salesperson_name||actor,
   currency:q.currency,invoice_number:reference.trim(),invoice_amount:q.amount,issue_date:issueDate,due_date:dueDate,status:'pending',labels:[],
   dispute_active:false,verification_hold:false,promise_to_pay_date:null,promise_confirmed:false,created_at:now()});
   event(d,'invoice_issued',poId,actor,`Invoice ${reference} created from accepted quotation; seller must verify legal document requirements`);
   for(const note of d.creditNotes.filter(n=>n.purchase_order_id===poId&&!n.invoice_id)){const creditId=id();
     d.credits.push({id:creditId,invoice_id:invoiceId,business_id:businessId,amount:note.amount,reason:`Credit note ${note.number}: ${note.reason}`,created_at:now()});
     note.invoice_id=invoiceId;note.credit_id=creditId;
     event(d,'credit_note_applied',poId,actor,`Credit note ${note.number} (${note.amount.toFixed(2)}) applied to invoice ${reference}`);}
 });return {success:true,id:invoiceId};
}
export function createPaymentClaim(invoiceId:string,amount:number,reference:string,evidenceId:string|null,
 actor:string,role:string,businessId=DEMO_BUSINESS_ID) {
 seller(actor,role,businessId);const inv=invoiceFor(invoiceId,businessId);
 if(!inv.purchase_order_id)throw Error('Invoice not associated with this PO workflow');
 const balance=computeInvoiceWithCustomer(inv,getStore(),getStore().demoState.simulated_date).outstanding_balance;
 if(!Number.isFinite(amount)||amount<=0||amount>balance||!validText(reference,100))throw Error('Check claim amount and reference');
 if (reference.trim() && getStore().paymentClaims.some(c=>c.invoice_id===invoiceId&&c.reference.toLowerCase()===reference.trim().toLowerCase()&&c.status!=='rejected')) throw Error('Duplicate payment reference: review the existing claim');
 if(evidenceId&&!getStore().orderEvidence.some(x=>x.id===evidenceId&&x.purchase_order_id===inv.purchase_order_id))throw Error('Evidence not linked to this order');
 const claimId=id(); update(d=>{d.paymentClaims.unshift({id:claimId,business_id:businessId,purchase_order_id:inv.purchase_order_id!,invoice_id:invoiceId,
   amount,reference:reference.trim(),evidence_id:evidenceId,status:'pending',created_at:now(),reviewed_at:null,reviewed_by:null});
   d.invoices.find(x=>x.id===invoiceId)!.verification_hold=true;
   event(d,'payment_claim',inv.purchase_order_id!,actor,`Payment claim ${amount} awaits independent verification`);
 });return {success:true,id:claimId};
}
export function reviewPaymentClaim(claimId:string, verified:boolean,verificationNote:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 seller(actor,role,businessId);
 const claim=getStore().paymentClaims.find(x=>x.id===claimId&&x.business_id===businessId);
 if(!claim||claim.status!=='pending')throw Error('Payment claim is not pending');
 if(!validText(verificationNote,500)||!verificationNote.trim())throw Error('Record verification source or rejection reason');
 const inv=invoiceFor(claim.invoice_id,businessId);
 const balance=computeInvoiceWithCustomer(inv,getStore(),getStore().demoState.simulated_date).outstanding_balance;
 if(verified&&claim.amount>balance)throw Error('Claim exceeds current outstanding balance');
 const paymentId=id();update(d=>{const current=d.paymentClaims.find(x=>x.id===claimId)!;
  Object.assign(current,{status:verified?'verified':'rejected',reviewed_by:actor,reviewed_at:now()});
  if(verified){d.payments.push({id:paymentId,business_id:businessId,invoice_id:claim.invoice_id,amount:claim.amount,
      payment_date:d.demoState.simulated_date,method:'seller_verified',...(claim.evidence_id?{evidence_id:claim.evidence_id}:{}),reference:claim.reference||verificationNote,
      verification_status:'recorded',created_at:now()});
    d.settlementReceipts.push({id:id(),business_id:businessId,purchase_order_id:claim.purchase_order_id,invoice_id:claim.invoice_id,
      payment_id:paymentId,receipt_number:`RCPT-${Date.now().toString().slice(-9)}`,amount:claim.amount,issued_at:now(),issued_by:actor});
  }
  d.invoices.find(x=>x.id===inv.id)!.verification_hold=d.paymentClaims.some(x=>x.invoice_id===inv.id&&x.status==='pending');
  event(d,verified?'payment_verified':'payment_claim_rejected',claim.purchase_order_id,actor,`${verified?'Verified':'Rejected'} payment claim; ${verificationNote}`);
 });return {success:true};
}
export function setOrderCase(poId:string,kind:OrderCase['kind'],reason:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 seller(actor,role,businessId);orderFor(poId,businessId);if(!['dispute','missing_document','other'].includes(kind)||!validText(reason,1000)||!reason.trim())throw Error('Describe the blocker');
 update(d=>{d.orderCases.push({id:id(),business_id:businessId,purchase_order_id:poId,kind,reason:reason.trim(),status:'open',opened_at:now(),resolved_at:null,resolution_note:''});
   for(const invoice of d.invoices.filter(x=>x.purchase_order_id===poId)){invoice.dispute_active=true;invoice.settlement_required=true;}
   event(d,'order_blocked',poId,actor,`Issue raised: ${reason}`);
 });return{success:true};
}
export function resolveOrderCase(caseId:string,note:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 seller(actor,role,businessId);const caseRecord=getStore().orderCases.find(x=>x.id===caseId&&x.business_id===businessId&&x.status==='open');
 if(!caseRecord||!validText(note,1000)||!note.trim())throw Error('Give a resolution note');
 update(d=>{const current=d.orderCases.find(x=>x.id===caseId)!;Object.assign(current,{status:'resolved',resolved_at:now(),resolution_note:note.trim()});
 const stillOpen=d.orderCases.some(x=>x.purchase_order_id===current.purchase_order_id&&x.status==='open');
 if(!stillOpen)for(const inv of d.invoices.filter(x=>x.purchase_order_id===current.purchase_order_id))inv.dispute_active=false;
 event(d,'order_blocker_resolved',current.purchase_order_id,actor,`Seller resolved blocker: ${note}`);
 });return{success:true};
}
export interface OrderBlocker { reason:string; critical:boolean; source:string; kind?:'quantity_mismatch'; item_name?:string; shortfall?:number; evidence_id?:string|null }
export function deriveOrderBlockers(poId:string):OrderBlocker[]{
 const d=getStore();const po=d.purchaseOrders.find(x=>x.id===poId);if(!po)return[];
 const q=d.quotations.find(x=>x.purchase_order_id===poId);
 const invoice=d.invoices.find(x=>x.purchase_order_id===poId);
 const out:OrderBlocker[]=[];
 for(const item of po.details?.items||[]){const delivery=d.deliveryConfirmations.find(x=>x.purchase_order_id===poId&&x.item_name===item.name);
   const credited=creditedQuantity(poId,item.name);
   if(delivery&&!delivery.shortfall_accepted_at&&delivery.accepted_quantity+credited<item.quantity!)out.push({
     reason:`${item.name}: ordered ${item.quantity}, accepted ${delivery.accepted_quantity}${credited?`, credited ${credited}`:''}`,critical:true,source:'Delivery confirmation vs PO',
     kind:'quantity_mismatch',item_name:item.name,shortfall:item.quantity!-delivery.accepted_quantity-credited,evidence_id:delivery.evidence_id});
 }
 for(const issue of d.orderCases.filter(x=>x.purchase_order_id===poId&&x.status==='open'))out.push({reason:issue.reason,critical:true,source:`Seller-recorded ${issue.kind}`});
 if(!q&&po.source_mode!=='quick_sale')out.push({reason:'Quotation not prepared',critical:false,source:'Quotation'});
 else if(q&&q.status!=='accepted')out.push({reason:`Quotation is ${q.status.replace('_',' ')}`,critical:false,source:'Buyer decision'});
 if(invoice?.verification_hold)out.push({reason:'Payment claim awaits verification',critical:true,source:'Payment claim'});
 if(invoice?.dispute_active)out.push({reason:'Invoice is under dispute/hold',critical:true,source:'Invoice review'});
 return out;
}

/** Seller issues a credit note for part of an item line that was not accepted (for example 20 of 100 damaged).
 * Before invoicing it is held and applied when the invoice is created; after invoicing it lowers the balance at once
 * and cancels reminders drafted for the old amount. The original quotation and invoice are never edited. */
export function issueCreditNote(poId:string,itemName:string,quantity:number,reason:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 seller(actor,role,businessId);const po=orderFor(poId,businessId);
 const q=getStore().quotations.find(x=>x.purchase_order_id===poId&&x.business_id===businessId&&x.status==='accepted');
 if(!q&&po.source_mode!=='quick_sale')throw Error('Record buyer acceptance of the quotation first');
 if((po.details?.items.filter(i=>i.name===itemName).length||0)!==1)throw Error('Choose one order line');
 const line=po.details!.items.find(i=>i.name===itemName)!;
 const delivery=getStore().deliveryConfirmations.find(x=>x.purchase_order_id===poId&&x.item_name===itemName&&x.business_id===businessId);
 if(!delivery)throw Error('Record the accepted quantity before issuing a credit note');
 const shortfall=line.quantity!-delivery.accepted_quantity-creditedQuantity(poId,itemName);
 if(!Number.isFinite(quantity)||quantity<=0)throw Error('Enter the quantity to credit');
 if(quantity>shortfall)throw Error(`Credit quantity cannot exceed the shortfall (${shortfall})`);
 if(!validText(reason,500)||!reason.trim())throw Error('Give the reason for the credit note');
 const quoted=(q?.items||po.details?.items||[]).find(i=>i.name===itemName);
 if(!quoted||!Number.isFinite(quoted.unit_price)||!quoted.quantity)throw Error('The accepted quotation has no price for this item');
 const netUnit=(quoted.unit_price!*quoted.quantity-(quoted.discount||0))/quoted.quantity;
 const amount=round2(quantity*netUnit);
 if(!(amount>0))throw Error('Credit amount must be positive');
 const invoice=getStore().invoices.find(x=>x.purchase_order_id===poId&&x.business_id===businessId);
 if(invoice){const balance=computeInvoiceWithCustomer(invoice,getStore(),getStore().demoState.simulated_date).outstanding_balance;
   if(amount>balance)throw Error('Credit amount exceeds the outstanding balance; review payments first');}
 const noteId=id();let number='';
 update(d=>{number=`CN-${po.reference}-${d.creditNotes.filter(n=>n.purchase_order_id===poId).length+1}`;
   let creditId:string|null=null;let cancelled=0;
   if(invoice){creditId=id();
     d.credits.push({id:creditId,invoice_id:invoice.id,business_id:businessId,amount,reason:`Credit note ${number}: ${reason.trim()}`,created_at:now()});
     for(const fu of d.followUpActions.filter(f=>f.invoice_id===invoice.id&&f.business_id===businessId&&f.send_state==='not_sent'&&['pending','approved'].includes(f.approval_state))){
       Object.assign(fu,{send_state:'cancelled',approval_state:'cancelled',approved_by:null,approved_at:null,approved_message_hash:null,delivery_status:`Credit note ${number} changed the balance`});cancelled++;}
   }
   d.creditNotes.push({id:noteId,business_id:businessId,purchase_order_id:poId,invoice_id:invoice?.id||null,credit_id:creditId,number,item_name:itemName,
     quantity,amount,reason:reason.trim(),created_at:now(),created_by:actor});
   event(d,'credit_note_issued',poId,actor,`Credit note ${number}: ${quantity} x ${itemName} = ${amount.toFixed(2)} (${reason.trim()})${cancelled?`; ${cancelled} reminder(s) for the old amount cancelled`:''}`);
 });
 return {success:true,id:noteId,number,amount};
}
/** Seller decides a delivery shortfall needs no adjustment (for example the buyer agreed to pay in full). The reason is recorded. */
export function acceptDeliveryShortfall(poId:string,itemName:string,reason:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 seller(actor,role,businessId);const po=orderFor(poId,businessId);
 const line=po.details?.items.find(i=>i.name===itemName);
 const delivery=getStore().deliveryConfirmations.find(x=>x.purchase_order_id===poId&&x.item_name===itemName&&x.business_id===businessId);
 if(!line||!delivery||delivery.accepted_quantity+creditedQuantity(poId,itemName)>=line.quantity!)throw Error('There is no open shortfall for this item');
 if(!validText(reason,500)||!reason.trim())throw Error('Give the reason for keeping the amount unchanged');
 update(d=>{const current=d.deliveryConfirmations.find(x=>x.id===delivery.id)!;
   Object.assign(current,{shortfall_note:reason.trim(),shortfall_accepted_at:now()});
   event(d,'delivery_shortfall_accepted',poId,actor,`No change for ${itemName} shortfall: ${reason.trim()}`);});
 return {success:true};
}

/** Orders that cannot move to invoice or payment until the seller acts, with who acts next. */
export function blockedOrders(businessId=DEMO_BUSINESS_ID):{order:PurchaseOrder;blockers:(OrderBlocker&{owner:string;action:string})[]}[]{
 const d=getStore();
 return d.purchaseOrders.filter(o=>o.business_id===businessId).map(order=>({order,blockers:deriveOrderBlockers(order.id).filter(b=>b.critical).map(b=>({...b,
   owner:b.kind==='quantity_mismatch'||b.source.startsWith('Seller-recorded')||b.source==='Payment claim'||b.source==='Invoice review'?'Seller':'Buyer',
   action:b.kind==='quantity_mismatch'?'Choose: deliver the rest, credit note or no change'
     :b.source==='Payment claim'?'Check the bank or gateway, then verify or reject the claim'
     :b.source==='Invoice review'?'Resolve the dispute before any reminder'
     :'Review the issue and record a resolution'}))})).filter(x=>x.blockers.length);
}

/** Seller adds agreed extra charges (for example a second delivery trip) to an issued invoice.
 * The balance goes up, the original invoice stays as issued, and reminders drafted for the old amount are cancelled. */
export function issueDebitNote(poId:string,description:string,amount:number,reason:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 seller(actor,role,businessId);const po=orderFor(poId,businessId);
 const invoice=getStore().invoices.find(x=>x.purchase_order_id===poId&&x.business_id===businessId);
 if(!invoice)throw Error('Create the invoice before adding a debit note');
 if(!validText(description,120)||!description.trim())throw Error('Describe the extra charge');
 if(!Number.isFinite(amount)||amount<=0||amount>1e7||round2(amount)!==amount)throw Error('Enter a positive amount with at most 2 decimals');
 if(!validText(reason,500)||!reason.trim())throw Error('Give the reason and who agreed to the charge');
 const noteId=id();let number='';
 update(d=>{number=`DN-${po.reference}-${d.debitNotes.filter(n=>n.purchase_order_id===poId).length+1}`;let cancelled=0;
   for(const fu of d.followUpActions.filter(f=>f.invoice_id===invoice.id&&f.business_id===businessId&&f.send_state==='not_sent'&&['pending','approved'].includes(f.approval_state))){
     Object.assign(fu,{send_state:'cancelled',approval_state:'cancelled',approved_by:null,approved_at:null,approved_message_hash:null,delivery_status:`Debit note ${number} changed the balance`});cancelled++;}
   d.debitNotes.push({id:noteId,business_id:businessId,purchase_order_id:poId,invoice_id:invoice.id,number,description:description.trim(),amount,reason:reason.trim(),created_at:now(),created_by:actor});
   event(d,'debit_note_issued',poId,actor,`Debit note ${number}: ${description.trim()} +${amount.toFixed(2)} (${reason.trim()})${cancelled?`; ${cancelled} reminder(s) for the old amount cancelled`:''}`);
 });
 return {success:true,id:noteId,number,amount};
}
