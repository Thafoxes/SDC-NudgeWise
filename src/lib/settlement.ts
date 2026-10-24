import type { Invoice } from '@/types';
import { getStore,update,computeInvoiceWithCustomer,DEMO_BUSINESS_ID,DEMO_SELLER_ID } from './store';
import type { StoreData } from './store';
import { deriveOrderBlockers } from './orderWorkflow';
function authorize(actor:string,role:string,businessId:string){
 if(role!=='seller'||!getStore().users.some(u=>u.id===DEMO_SELLER_ID&&u.business_id===businessId&&u.name===actor&&u.role===role))throw Error('Seller authorization required');
}
function financialKey(inv:Invoice,data:StoreData){
 const payments=data.payments.filter(p=>p.invoice_id===inv.id&&p.business_id===inv.business_id&&p.verification_status==='recorded');
 const credits=data.credits.filter(c=>c.invoice_id===inv.id&&c.business_id===inv.business_id);
 const debits=data.debitNotes.filter(n=>n.invoice_id===inv.id&&n.business_id===inv.business_id);
 return JSON.stringify([inv.invoice_amount,payments.map(p=>[p.id,p.amount,p.payment_date,p.method,p.reference]).sort(),credits.map(c=>[c.id,c.amount]).sort(),debits.map(n=>[n.id,n.amount]).sort()]);
}
export function hasCurrentFinalReceipt(inv:Invoice,data:StoreData):boolean {
 return !!inv.final_receipt && inv.final_receipt.financial_key===financialKey(inv,data);
}
export function settlementBlockers(inv:Invoice,data:StoreData):string[]{
 const computed=computeInvoiceWithCustomer(inv,data,data.demoState.simulated_date);const reasons:string[]=[];
 if(computed.outstanding_balance>0)reasons.push('Record and verify the remaining payment before issuing a final receipt.');
 if(Math.round((computed.total_paid+computed.total_credits-inv.invoice_amount-(computed.total_debits||0))*100)!==0&&computed.outstanding_balance===0)
  reasons.push('Payments and credits exceed the amount due; resolve the credit balance first.');
 if(inv.verification_hold||data.paymentClaims.some(c=>c.invoice_id===inv.id&&c.business_id===inv.business_id&&c.status==='pending'))reasons.push('Finish reviewing all pending payment claims and release the verification hold.');
 if(inv.dispute_active||data.orderCases.some(c=>c.purchase_order_id===inv.purchase_order_id&&c.business_id===inv.business_id&&c.status==='open'))reasons.push('Resolve open disputes and review cases first.');
 return reasons;
}
export function orderCompletionBlockers(orderId:string,data=getStore()):string[]{
 const order=data.purchaseOrders.find(o=>o.id===orderId);if(!order)return ['Order not found.'];
 const inv=data.invoices.find(i=>i.purchase_order_id===orderId&&i.business_id===order.business_id);
 const reasons=inv?settlementBlockers(inv,data):['Create an invoice first.'];
 if(order.status!=='approved')reasons.push('Approve order processing first.');
 if(order.source_mode!=='quick_sale'&&!data.quotations.some(q=>q.purchase_order_id===orderId&&q.business_id===order.business_id&&q.status==='accepted'))reasons.push('Record buyer acceptance of the quotation.');
 if(inv&&!hasCurrentFinalReceipt(inv,data))reasons.push('Issue the final receipt for the current settled balance.');
 if(!order.details?.items.length)reasons.push('Record the agreed order items.');
 for(const item of order.details?.items||[]){
  const delivery=data.deliveryConfirmations.find(d=>d.purchase_order_id===orderId&&d.business_id===order.business_id&&d.item_name===item.name);
  const credited=data.creditNotes.filter(n=>n.purchase_order_id===orderId&&n.business_id===order.business_id&&n.item_name===item.name).reduce((sum,n)=>sum+n.quantity,0);
  if(!delivery||(delivery.accepted_quantity+credited<(item.quantity||0)&&!delivery.shortfall_accepted_at))reasons.push(`Record delivery acceptance or resolve the shortfall for ${item.name}.`);
 }
 for(const blocker of deriveOrderBlockers(orderId).filter(b=>b.critical))if(!reasons.includes(blocker.reason))reasons.push(blocker.reason);
 return reasons;
}
export function finalReceiptSnapshot(inv:Invoice,data:StoreData,note:string,actor:string,issuedAt=new Date().toISOString()) {
 const totals=computeInvoiceWithCustomer(inv,data,data.demoState.simulated_date);
 return {number:`FR-${crypto.randomUUID()}`,issued_at:issuedAt,issued_by:actor,verification_note:note.trim(),financial_key:financialKey(inv,data),
  invoice_amount:inv.invoice_amount,total_debits:totals.total_debits||0,total_credits:totals.total_credits,total_paid:totals.total_paid,
  payments:data.payments.filter(p=>p.invoice_id===inv.id&&p.business_id===inv.business_id&&p.verification_status==='recorded').map(p=>({id:p.id,amount:p.amount,payment_date:p.payment_date,method:p.method,reference:p.reference,...(p.evidence_id?{evidence_id:p.evidence_id}:{})}))};
}
export function issueFinalReceipt(invoiceId:string,note:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 authorize(actor,role,businessId);const data=getStore();const inv=data.invoices.find(i=>i.id===invoiceId&&i.business_id===businessId);
 if(!inv)throw Error('Invoice not found for this business');
 if(typeof note!=='string'||!note.trim()||note.length>1000||/[\x00-\x1f\x7f]/.test(note))throw Error('Enter how you verified funds received or a credit-only settlement.');
 const blockers=settlementBlockers(inv,data);if(blockers.length)throw Error(blockers[0]);
 if(hasCurrentFinalReceipt(inv,data))return {success:true,number:inv.final_receipt!.number};
 const payments=data.payments.filter(p=>p.invoice_id===inv.id&&p.business_id===businessId&&p.verification_status==='recorded');
 const issuedAt=new Date().toISOString();const receipt=finalReceiptSnapshot(inv,data,note,actor,issuedAt);const number=receipt.number;
 update(d=>{
  const invoice=d.invoices.find(i=>i.id===invoiceId)!;const previous=invoice.final_receipt;
  invoice.final_receipt=receipt;
  if(inv.purchase_order_id)for(const payment of payments)if(!d.settlementReceipts.some(r=>r.payment_id===payment.id))
   d.settlementReceipts.push({id:crypto.randomUUID(),business_id:businessId,purchase_order_id:inv.purchase_order_id,invoice_id:invoiceId,payment_id:payment.id,
    receipt_number:`RCPT-${crypto.randomUUID()}`,amount:payment.amount,issued_at:issuedAt,issued_by:actor});
  d.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:invoiceId,event_type:'final_receipt_issued',actor,actor_role:'seller',
   description:`Final settlement ${number} issued after seller confirmation: ${note.trim()}`,metadata:{order_id:inv.purchase_order_id,previous_final_receipt:previous},created_at:issuedAt});
 });return {success:true,number};
}
export function completeOrder(orderId:string,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 authorize(actor,role,businessId);const data=getStore();const order=data.purchaseOrders.find(o=>o.id===orderId&&o.business_id===businessId);
 if(!order)throw Error('Order not found for this business');
 const blockers=orderCompletionBlockers(orderId,data);if(blockers.length)throw Error(blockers[0]);
 const invoice=data.invoices.find(i=>i.purchase_order_id===orderId&&i.business_id===businessId)!;
 if(order.completed_at&&order.completion_key===invoice.final_receipt!.financial_key)return {success:true};
 update(d=>{const current=d.purchaseOrders.find(o=>o.id===orderId)!;
  current.completed_at=new Date().toISOString();current.completed_by=actor;current.completion_key=invoice.final_receipt!.financial_key;
  d.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:invoice.id,event_type:'order_completed',actor,actor_role:'seller',
   description:`Order ${order.reference} completed: delivery resolved, balance settled and final receipt issued.`,metadata:{order_id:orderId,receipt_number:invoice.final_receipt!.number},created_at:current.completed_at});
 });return {success:true};
}
