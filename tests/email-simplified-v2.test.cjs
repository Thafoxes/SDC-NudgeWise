const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const store=require('../.server-build/lib/store.js');
const {createEmailPhase8}=require('../server/email-phase8.cjs');
function createFixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nudgewise-email-v2-'));
 const storage=new Map();store.configureStorage({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)});
 const d=store.getStore(),b=store.DEMO_BUSINESS_ID;
 d.customers.push({id:'customer-x',name:'Test Buyer',email:'buyer@example.test',phone:'0123456789',business_id:b});
 d.purchaseOrders.push({id:'order-x',customer_id:'customer-x',business_id:b,reference:'PO-TX-101',status:'approved',source_mode:'manual',created_at:new Date().toISOString(),details:{items:[{name:'Box',code:'BOX',quantity:2,unit_price:12,discount:0}],currency:'MYR',order_date:'2026-10-24'}});
 d.quotations.push({id:'qt-x',purchase_order_id:'order-x',business_id:b,reference:'QT-TX-101',items:[{name:'Box',code:'BOX',quantity:2,unit_price:12,discount:0}],currency:'MYR',amount:24,payment_terms:'Net 14',delivery_terms:'Pickup',valid_until:'2026-11-24',status:'draft',buyer_decision_note:'',buyer_decision_evidence_id:null,created_at:'2026-10-24T00:00:00.000Z',updated_at:'2026-10-24T00:00:00.000Z'});
 let index=0;const sent=[],inbound=[];
 const gmail={status:()=>({connected:true,canRead:true,incomingEnabled:true,email:'seller@example.test',autoRemindersEnabled:false,automationLiveEnabled:false}),sendMessage:async x=>{sent.push(x);return {id:`msg-${++index}`,threadId:`thread-${index}`}},readThread:async thread=>inbound.filter(m=>m.threadId===thread)};
 const service=createEmailPhase8({directory:dir,gmail,transaction:fn=>fn(),flush:async()=>{},api:null,businessId:b});
 const push=(thread,body,id)=>inbound.push({id,threadId:thread,internalDate:String(Date.now()),payload:{mimeType:'text/plain',headers:[{name:'From',value:'Test Buyer <buyer@example.test>'},{name:'Subject',value:'Re: QT-TX-101'}],body:{data:Buffer.from(body).toString('base64url')}}});
 return {service,d,sent,push,cleanup(){service.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('seller approval persisted for quotation version; revision invalidates it',()=>{
 const e=createFixture();try{
  assert.equal(e.service.issuanceStatus({quotationId:'qt-x'}).approved,false);
  assert.throws(()=>e.service.approveQuotation({quotationId:'qt-x',confirmed:false}),/seller approval/i);
  assert.equal(e.service.approveQuotation({quotationId:'qt-x',confirmed:true}).approved,true);
  store.update(d=>{d.quotations.find(q=>q.id==='qt-x').updated_at='2026-10-25T00:00:00.000Z';});
  assert.equal(e.service.issuanceStatus({quotationId:'qt-x'}).approved,false);
 }finally{e.cleanup();}
});
test('send-only document is not monitored; monitored quotation reply requires seller review',async()=>{
 const e=createFixture();try{
  e.service.approveQuotation({quotationId:'qt-x',confirmed:true});
  const only=e.service.compose({kind:'quotation',id:'order-x',mode:'send_only'});
  assert.doesNotMatch(only.body,/CHANGES REQUESTED/);
  await e.service.sendManual({...only,confirmed:true});
  assert.equal(e.service.overview().history[0].send_mode,'send_only');
  e.push('thread-1','We accept the quotation.', 'ignored1');
  assert.equal((await e.service.syncReplies()).imported,0);
  const tracked=e.service.compose({kind:'quotation',id:'order-x',mode:'await_reply'});
  assert.match(tracked.body,/CHANGES REQUESTED/);
  await e.service.sendManual({...tracked,confirmed:true});
  e.push('thread-2','APPROVED\n\nOn Sat, Oct 24, Seller wrote:\n> CHANGES REQUESTED\n> REJECTED', 'read2');
  assert.equal((await e.service.syncReplies()).imported,1);
  assert.equal(e.service.overview().replies[0].category,'accepted');
  assert.equal(e.service.overview().replies[0].review_state,'pending');
  assert.equal(e.d.quotations[0].status,'draft');
 }finally{e.cleanup();}
});
test('tracked test reply has classification but cannot alter business records or trigger tasks',async()=>{
 const e=createFixture();try{
  const result=await e.service.sendMonitoredTest({to:'buyer@example.test',subject:'NudgeWise TEST',message:'Please reply.',confirmed:true});
  e.push(result.thread_id,'REJECTED\nOn Sat, Oct 24, Seller wrote:\n> APPROVED', 'test-reply');
  assert.equal((await e.service.syncReplies()).imported,1);
  const r=e.service.overview().replies[0];assert.equal(r.category,'rejected');assert.equal(r.document_kind,'test');assert.equal(r.review_state,'test');
  assert.equal(e.service.overview().tasks.length,0);assert.equal(e.d.quotations[0].status,'draft');
 }finally{e.cleanup();}
});
test('payment request sends with Gmail, rejects demo payment links and disputes',async()=>{
 const e=createFixture();try{
  e.d.invoices.push({id:'inv-x',business_id:store.DEMO_BUSINESS_ID,customer_id:'customer-x',purchase_order_id:'order-x',invoice_number:'INV-TX-101',status:'pending',invoice_amount:24,currency:'MYR',issue_date:'2026-10-24',due_date:'2026-11-07',verification_hold:false,dispute_active:false});
  const base={invoiceId:'inv-x',to:'buyer@example.test',subject:'Payment INV-TX-101',message:'Please pay the outstanding MYR 24.',confirmed:true,mode:'send_only'};
  await assert.rejects(()=>e.service.sendPaymentRequest({...base,message:'Pay at http://localhost:5173/#/demo-payment'}),/demonstration payment links/i);
  await e.service.sendPaymentRequest(base);
  assert.equal(e.sent.length,1);assert.equal(e.service.overview().history[0].send_mode,'send_only');
  await assert.rejects(()=>e.service.sendPaymentRequest(base),/recently submitted/i);
  store.update(d=>{d.invoices.find(i=>i.id==='inv-x').dispute_active=true;});
  await assert.rejects(()=>e.service.sendPaymentRequest(base),/settled, disputed or under payment verification/i);
 }finally{e.cleanup();}
});
