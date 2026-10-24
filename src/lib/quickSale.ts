import type { PurchaseOrderItem,Invoice } from '@/types';
import {getStore,update,DEMO_BUSINESS_ID,DEMO_SELLER_ID} from './store';
import {emptyPurchaseOrderDetails,validatePurchaseOrderDetails,purchaseOrderTotal} from './purchaseOrder';
import {supplierFromCompany} from './companyProfile';
import {getOrderEligibility} from './customerOrders';
import {validDate} from './replyAnalysis';
import {finalReceiptSnapshot} from './settlement';
export interface SaleAttachment {id:string;filename:string;mime_type:string}
export interface QuickSaleInput {
 order_evidence?:SaleAttachment; payment_evidence?:SaleAttachment; extraction_reviewed?:boolean;
 customer_id:string; reference:string; issue_date:string; due_date:string; items:PurchaseOrderItem[];
 payment_mode:'paid_now'|'pay_later'; handed_over:boolean; funds_confirmed:boolean;
 method:string; payment_reference:string; verification_note:string; override_reason:string;
}
export function createQuickSale(input:QuickSaleInput,actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 const data=getStore();
 if(role!=='seller'||!data.users.some(u=>u.id===DEMO_SELLER_ID&&u.name===actor&&u.role===role&&u.business_id===businessId))throw Error('Seller authorization required');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid quick sale');
 const customer=data.customers.find(c=>c.id===input.customer_id&&c.business_id===businessId);
 const business=data.businesses.find(b=>b.id===businessId);if(!customer||!business)throw Error('Select a customer in this workspace');
 for(const [key,max] of Object.entries({reference:80,method:30,payment_reference:100,verification_note:1000,override_reason:500})){
  const value=input[key as keyof QuickSaleInput];if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw Error(`Check ${key.replace(/_/g,' ')}`);
 }
 if(!input.reference.trim())throw Error('Enter an invoice reference');
 if(data.invoices.some(i=>i.business_id===businessId&&i.invoice_number.toLowerCase()===input.reference.trim().toLowerCase()))throw Error('Invoice reference already exists. Open the existing invoice instead of recording this sale twice.');
 if(!validDate(input.issue_date)||input.issue_date>data.demoState.simulated_date)throw Error('Choose a valid issue date, no later than today');
 if(!['paid_now','pay_later'].includes(input.payment_mode)||typeof input.handed_over!=='boolean'||typeof input.funds_confirmed!=='boolean')throw Error('Choose payment timing and confirm handover');
 if(input.payment_mode==='pay_later'&&(!validDate(input.due_date)||input.due_date<input.issue_date))throw Error('Choose an agreed due date on or after the issue date');
 if(input.payment_mode==='paid_now'&&(!input.handed_over||!input.funds_confirmed||!input.verification_note.trim()))throw Error('Confirm funds received, goods handed over, and enter the verification source for an immediate sale');
 if(input.payment_mode==='paid_now'&&!['cash','bank_transfer','duitnow','cheque','card'].includes(input.method))throw Error('Select a supported payment method');
 const details=validatePurchaseOrderDetails({...emptyPurchaseOrderDetails(),...supplierFromCompany(business),currency:business.currency,
  buyer_name:customer.name,buyer_address:customer.address||'',buyer_phone:customer.phone||'',buyer_email:customer.email||'',order_date:input.issue_date,
  payment_terms:input.payment_mode==='paid_now'?'Paid on sale':`Payment due ${input.due_date}`,items:input.items});
 if(details.items.some(i=>!Number.isSafeInteger(Math.round(i.quantity!*i.unit_price!*100))||!Number.isSafeInteger(Math.round(i.discount!*100))))throw Error('Item amounts exceed supported limits');
 const total=purchaseOrderTotal(details.items);if(!details.items.length||total===null||total<=0||total>1e9)throw Error('Enter priced items with a positive total');
 // shortcut: delivery matches descriptions; require unique names until delivery uses line IDs.
 if(new Set(details.items.map(i=>i.name.toLowerCase())).size!==details.items.length)throw Error('Combine repeated item descriptions into one row or use distinct descriptions');
 const eligibility=getOrderEligibility(customer.id,businessId);
 if(!eligibility.allowed&&!input.override_reason.trim())throw Error('Customer is on hold. Enter a seller reason for this sale or resolve the hold.');
 for(const evidence of [input.order_evidence,input.payment_evidence])if(evidence!=null){
  if(typeof evidence!=='object'||!/^[a-f0-9-]{36}$/.test(evidence.id)||typeof evidence.filename!=='string'||evidence.filename.length>255||/[\x00-\x1f\x7f]/.test(evidence.filename)||!['image/png','image/jpeg','application/pdf'].includes(evidence.mime_type))throw Error('Invalid sale attachment');
 }
 if(input.order_evidence&&input.extraction_reviewed!==true)throw Error('Review all extracted order items, prices and currency before issuing the invoice');
 if(input.order_evidence&&input.order_evidence.id===input.payment_evidence?.id)throw Error('Use separate files for the order document and payment proof');
 const orderId=crypto.randomUUID(),invoiceId=crypto.randomUUID(),issuedAt=new Date().toISOString();
 update(d=>{
  const order={id:orderId,business_id:businessId,customer_id:customer.id,reference:`SALE-${orderId.slice(0,8)}`,source_mode:'quick_sale' as const,status:'approved' as const,
   created_at:issuedAt,approved_at:issuedAt,approved_by:actor,details,
   ...(!eligibility.allowed?{override:{reason:input.override_reason.trim(),actor,approved_at:issuedAt,blockers:eligibility.blockers}}:{})};
  d.purchaseOrders.unshift(order);
  for(const [evidence,kind] of [[input.order_evidence,'chat_screenshot'],[input.payment_evidence,'payment_proof']] as const)if(evidence)
   d.orderEvidence.push({...evidence,kind,business_id:businessId,purchase_order_id:orderId,saved_at:issuedAt});
  const invoice:Invoice={id:invoiceId,business_id:businessId,customer_id:customer.id,purchase_order_id:orderId,prepared_by:business.salesperson_name||actor,
   currency:details.currency,invoice_number:input.reference.trim(),invoice_amount:total,issue_date:input.issue_date,due_date:input.payment_mode==='paid_now'?input.issue_date:input.due_date,
   status:'pending',labels:[],dispute_active:false,verification_hold:false,promise_to_pay_date:null,promise_confirmed:false,created_at:issuedAt};
  d.invoices.unshift(invoice);
  if(input.handed_over)for(const item of details.items)d.deliveryConfirmations.push({id:crypto.randomUUID(),business_id:businessId,purchase_order_id:orderId,
   item_name:item.name,accepted_quantity:item.quantity!,reviewer_note:'Seller confirmed goods handed over at direct sale',evidence_id:null,confirmed_at:issuedAt,shortfall_note:'',shortfall_accepted_at:null});
  if(input.payment_mode==='paid_now'){
   const paymentId=crypto.randomUUID();d.payments.push({id:paymentId,business_id:businessId,invoice_id:invoiceId,amount:total,payment_date:input.issue_date,
    method:input.method,...(input.payment_evidence?{evidence_id:input.payment_evidence.id}:{}),reference:input.payment_reference.trim(),verification_status:'recorded',created_at:issuedAt});
   invoice.status='paid';invoice.final_receipt=finalReceiptSnapshot(invoice,d,input.verification_note,actor,issuedAt);
   d.settlementReceipts.push({id:crypto.randomUUID(),business_id:businessId,purchase_order_id:orderId,invoice_id:invoiceId,payment_id:paymentId,
    receipt_number:`RCPT-${paymentId}`,amount:total,issued_at:issuedAt,issued_by:actor});
   Object.assign(order,{completed_at:issuedAt,completed_by:actor,completion_key:invoice.final_receipt.financial_key});
  }
  d.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:invoiceId,event_type:'quick_sale_created',actor,actor_role:'seller',
   description:`Direct sale ${invoice.invoice_number}: ${input.payment_mode==='paid_now'?'funds and handover confirmed; receipt issued and sale completed':'invoice issued on agreed payment terms'}; quotation and buyer PO skipped.`,
   metadata:{order_id:orderId,override:!eligibility.allowed?order.override:undefined,verification_note:input.payment_mode==='paid_now'?input.verification_note.trim():undefined,handed_over:input.handed_over},created_at:issuedAt});
 });return {success:true,id:invoiceId,order_id:orderId};
}
