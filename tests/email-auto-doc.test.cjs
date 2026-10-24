const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os'), path=require('node:path'), fs=require('node:fs');
const store=require('../.server-build/lib/store.js');
const {finalReceiptSnapshot}=require('../.server-build/lib/settlement.js');
const {createEmailPhase8}=require('../server/email-phase8.cjs');
function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nw-auto-doc-'));
 const memory=new Map();store.configureStorage({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)});
 const data=store.getStore(),businessId=store.DEMO_BUSINESS_ID;
 const customer={id:'auto-doc-customer',business_id:businessId,name:'Example Buyer',phone:'0123456789',email:'buyer@example.test'};
 data.customers.push(customer);
 let sent=0;const deliveries=[];
 const gmail={status:()=>({connected:true,email:'seller@example.test',autoRemindersEnabled:false,automationLiveEnabled:false}),
  sendMessage:async payload=>{sent++;deliveries.push(payload);return {id:`msg-${sent}`,threadId:`thread-${sent}`};}};
 const service=createEmailPhase8({directory,gmail,transaction:fn=>fn(),flush:async()=>{},businessId,api:null});
 function invoice(id,createdAt){const v={id,business_id:businessId,customer_id:customer.id,purchase_order_id:null,invoice_number:`INV-${id}`,invoice_amount:100,issue_date:'2026-10-24',due_date:'2026-11-07',status:'pending',labels:[],dispute_active:false,verification_hold:false,promise_to_pay_date:null,promise_confirmed:false,created_at:createdAt};data.invoices.push(v);return v;}
 const cleanup=()=>{service.close();fs.rmSync(directory,{recursive:true,force:true});};
 return {service,data,businessId,customer,invoice,sent:()=>sent,deliveries,cleanup};
}
test('document auto-send defaults OFF; turning on does not email old invoices',async()=>{
 const e=fixture();try{
  const old=e.invoice('old',new Date(Date.now()-60000).toISOString());
  assert.deepEqual(e.service.overview().documentAutomation,{invoice:false,receipt:false});
  await e.service.tickDocuments();assert.equal(e.sent(),0);
  assert.throws(()=>e.service.updateDocumentAutomation({kind:'invoice',enabled:true}),/Seller confirmation/);
  e.service.updateDocumentAutomation({kind:'invoice',enabled:true,confirmed:true});
  await e.service.tickDocuments();assert.equal(e.sent(),0);
  assert.equal(e.service.overview().history.length,0);
 }finally{e.cleanup();}
});
test('newly issued invoice is emailed once with invoice PDF and does not require buyer PO',async()=>{
 const e=fixture();try{
  e.service.updateDocumentAutomation({kind:'invoice',enabled:true,confirmed:true});
  e.invoice('new',new Date(Date.now()+2000).toISOString());
  await e.service.tickDocuments();await e.service.tickDocuments();
  assert.equal(e.sent(),1);assert.match(e.deliveries[0].attachment.filename,/invoice/i);
  assert.ok(e.deliveries[0].attachment.bytes.length>100);
  assert.equal(e.service.overview().history[0].kind,'invoice');
  assert.equal(e.service.overview().history[0].state,'accepted');
  e.service.updateDocumentAutomation({kind:'invoice',enabled:false});
  e.invoice('later',new Date(Date.now()+4000).toISOString());await e.service.tickDocuments();assert.equal(e.sent(),1);
 }finally{e.cleanup();}
});
test('manual invoice email already sent prevents duplicate automatic invoice',async()=>{
 const e=fixture();try{
  e.service.updateDocumentAutomation({kind:'invoice',enabled:true,confirmed:true});
  e.invoice('manual',new Date(Date.now()+2000).toISOString());
  const draft=e.service.compose({kind:'invoice',id:'manual'});
  await e.service.sendManual({...draft,confirmed:true});
  await e.service.tickDocuments();assert.equal(e.sent(),1);
 }finally{e.cleanup();}
});
test('auto receipt requires valid seller-confirmed final receipt and sends only once',async()=>{
 const e=fixture();try{
  const inv=e.invoice('receipt',new Date(Date.now()-60000).toISOString());
  e.service.updateDocumentAutomation({kind:'receipt',enabled:true,confirmed:true});
  await e.service.tickDocuments();assert.equal(e.sent(),0);
  e.data.payments.push({id:'test-payment',business_id:e.businessId,invoice_id:inv.id,amount:100,payment_date:'2026-10-24',method:'bank_transfer',reference:'TEST',verification_status:'recorded',created_at:new Date().toISOString()});
  inv.status='paid';inv.final_receipt=finalReceiptSnapshot(inv,e.data,'Confirmed transfer','Example Seller',new Date(Date.now()+2000).toISOString());
  await e.service.tickDocuments();await e.service.tickDocuments();assert.equal(e.sent(),1);
  assert.equal(e.service.overview().history[0].kind,'receipt');
  assert.match(e.deliveries[0].attachment.filename,/receipt/i);
 }finally{e.cleanup();}
});
test('customers without email receive a manual follow-up instead of a send',async()=>{
 const e=fixture();try{
  e.service.updateDocumentAutomation({kind:'invoice',enabled:true,confirmed:true});
  e.invoice('noemail',new Date(Date.now()+2000).toISOString());e.customer.email='';
  await e.service.tickDocuments();assert.equal(e.sent(),0);
  assert.match(e.service.overview().tasks[0].reason,/no customer email/i);
 }finally{e.cleanup();}
});
