import type {Invoice} from '@/types';
import {getStore,update,DEMO_BUSINESS_ID} from './store';
import {emptyPurchaseOrderDetails} from './purchaseOrder';
import {supplierFromCompany} from './companyProfile';
import {requireDemoSeller} from './knowledge';
import {finalReceiptSnapshot} from './settlement';
export function manageDemoScenarios(mode:'load'|'reset'|'remove',actor:string,role:string,businessId=DEMO_BUSINESS_ID){
 requireDemoSeller(actor,role,businessId);
 if(!['load','reset','remove'].includes(mode))throw Error('Invalid demo operation');
 const current=getStore();const manifest=current.demoScenarios;
 if(manifest&&manifest.business_id!==businessId)throw Error('Demo scenarios belong to another workspace');
 if(mode==='load'&&manifest)return {success:true,message:'Demo scenarios are already loaded.'};
 const owned=new Set(manifest?.ids||[]);
 const derived=['payments','credits','followUpActions','customerResponses','activityEvents','notifications','deliveryConfirmations','paymentClaims','settlementReceipts','orderCases','creditNotes','debitNotes','orderEvidence'] as const;
 // Actions performed on a demo invoice/order remain part of that scenario; new sales records are protected.
 const references=(v:unknown):boolean=>typeof v==='string'?owned.has(v):!!v&&typeof v==='object'&&Object.values(v).some(references);
 if(manifest)for(const key of derived)for(const row of current[key])if(row.business_id===businessId&&references(row))owned.add(row.id);

 // A manual record linked to a sample is preserved by refusing removal, not cascading deletion.
 if(mode!=='load'&&manifest)for(const value of Object.values(current))if(Array.isArray(value))for(const row of value){
  if(!owned.has(row.id)&&references(row))throw Error('A non-demo record links to demo data. Remove its link or keep the scenarios; no records were removed.');
 }
 update(d=>{
  if(manifest){for(const [key,value] of Object.entries(d))if(Array.isArray(value))
   (d as unknown as Record<string,unknown>)[key]=value.filter(row=>row.business_id!==businessId||!owned.has(row.id));delete d.demoScenarios;}
  if(mode==='remove')return;
  const today=d.demoState.simulated_date;const date=(days:number)=>{const dt=new Date(today+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+days);return dt.toISOString().slice(0,10);};
  const ids:string[]=[];const id=()=>{const value=crypto.randomUUID();ids.push(value);return value;};const stamp=new Date().toISOString();
  const company=d.businesses.find(b=>b.id===businessId)!;
  const customers=['Normal credit','Partial payment','Long overdue','Multiple overdue','Active dispute','Resolved dispute unpaid','Awaiting verification','Completed sale'].map((name,n)=>{
   const c={id:id(),business_id:businessId,name:`DEMO ${name}`,phone:`+6030000010${n}`,telegram_chat_id:null,email:`demo${n}@example.invalid`,address:'28 Jalan Contoh, Kuala Lumpur, Malaysia'};d.customers.push(c);return c;
  });
  const orders=customers.map((c,n)=>{
   const details={...emptyPurchaseOrderDetails(),...supplierFromCompany(company),buyer_name:c.name,buyer_address:c.address,buyer_phone:c.phone,buyer_email:c.email,
    order_date:date(-100),currency:company.currency,payment_terms:'Payment within 7 days of invoice date; investigate disputes before follow-up.',
    items:[{name:'Demo office supply pack',code:'DEMO-PACK',quantity:2,unit_price:380,discount:0}],document_total:760};
   const order={id:id(),business_id:businessId,customer_id:c.id,reference:`DEMO-SALE-${n+1}`,status:'approved' as const,source_mode:'quick_sale' as const,created_at:stamp,approved_at:stamp,approved_by:actor,details};d.purchaseOrders.push(order);return order;
  });
  for(let n=0;n<customers.length;n++){
   const inv:Invoice={id:id(),business_id:businessId,customer_id:customers[n].id,purchase_order_id:orders[n].id,invoice_number:`DEMO-INV-${n+1}`,invoice_amount:760,
    issue_date:date(-100),due_date:date(n===0?7:n===2?-90:-14),status:'pending' as const,labels:['Demo scenario'],dispute_active:n===4,settlement_required:n===4||n===5,
    verification_hold:n===6,promise_to_pay_date:n===2?date(-3):null,promise_confirmed:n===2,created_at:stamp};d.invoices.push(inv);
   if(n===1||n===7)d.payments.push({id:id(),business_id:businessId,invoice_id:inv.id,amount:n===1?200:760,payment_date:date(-1),method:'bank_transfer',reference:'DEMO - fictional settled funds',verification_status:'recorded',created_at:stamp});
   if(n===6)d.paymentClaims.push({id:id(),business_id:businessId,purchase_order_id:orders[n].id,invoice_id:inv.id,amount:760,reference:'DEMO pending check',evidence_id:null,status:'pending',created_at:stamp,reviewed_at:null,reviewed_by:null});
   if(n===7){
    d.deliveryConfirmations.push({id:id(),business_id:businessId,purchase_order_id:orders[n].id,item_name:'Demo office supply pack',accepted_quantity:2,reviewer_note:'Fictional demo handover',evidence_id:null,confirmed_at:stamp});
    inv.status='paid';
    d.settlementReceipts.push({id:id(),business_id:businessId,purchase_order_id:orders[n].id,invoice_id:inv.id,payment_id:d.payments.find(p=>p.invoice_id===inv.id)!.id,receipt_number:'DEMO-RCPT-8',amount:760,issued_at:stamp,issued_by:actor});
    const receipt=finalReceiptSnapshot(inv,d,'Fictional demo payment and handover',actor,stamp);
    Object.assign(inv,{final_receipt:receipt});Object.assign(orders[n],{completed_at:stamp,completed_by:actor,completion_key:receipt.financial_key});
   }
   d.activityEvents.push({id:id(),business_id:businessId,invoice_id:inv.id,event_type:'demo_scenario_loaded',actor,actor_role:'seller',metadata:{},description:`Fictional scenario: ${customers[n].name}`,created_at:stamp});
  }
  for(let n=0;n<2;n++)d.invoices.push({...d.invoices.find(i=>i.invoice_number==='DEMO-INV-4'&&i.business_id===businessId)!,id:id(),invoice_number:`DEMO-INV-MULTI-${n+1}`,purchase_order_id:undefined,due_date:date(-30-n*30)});
  for(const [n,title] of ['Quotation draft','Agreed quotation','PO awaiting review','PO total mismatch','Blocked: active dispute','Blocked: unsettled dispute'].entries()){
   const base=orders[n>=4?n:0];const order={...base,id:id(),reference:`DEMO-REVIEW-${n+1}`,source_mode:'manual' as const,status:'draft' as const,approved_at:undefined,approved_by:undefined,
    details:{...base.details,document_total:n===3?1:760}};d.purchaseOrders.push(order);
   if(n===1){Object.assign(order,{status:'approved',approved_at:stamp,approved_by:actor});}
   if(n<2)d.quotations.push({id:id(),business_id:businessId,purchase_order_id:order.id,reference:`DEMO-QUO-${n+1}`,items:order.details.items,amount:760,currency:company.currency,
    payment_terms:order.details.payment_terms,delivery_terms:'Collection after agreement',valid_until:date(14),status:n===0?'draft':'accepted',buyer_decision_note:n===1?'Fictional demo buyer agreement':'',buyer_decision_evidence_id:null,created_at:stamp,updated_at:stamp});
  }
  d.knowledgePolicies??=[];d.knowledgePolicies.push({id:id(),business_id:businessId,title:'DEMO Credit and dispute policy',version:'1',effective_date:date(-100),active:true,
   text:'Fictional demo policy. Review invoices more than 30 days overdue and contact the customer politely. Do not invent fees or threats. Active disputes pause reminders and block new orders. Resolved disputes with unpaid settlement obligations still block orders. Ordinary overdue invoices alone do not block orders. A bank screenshot is a claim, not proof of settled funds. Verify bank records before recording payment.',reviewed_by:actor,reviewed_at:stamp});
  d.demoScenarios={business_id:businessId,reference_date:today,ids};
 });return {success:true,message:mode==='remove'?'Demo scenarios removed.':'Demo scenarios loaded: 8 customers, 10 invoices, 14 orders and 2 quotations.'};
}
