const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const store=require('../.server-build/lib/store.js');
const {createEmailPhase8}=require('../server/email-phase8.cjs');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nw-workspace-u-'));
 const state=new Map();store.configureStorage({getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v)});
 const d=store.getStore(),business_id=store.DEMO_BUSINESS_ID;
 const c={id:'buyer1',business_id,name:'Synthetic Buyer',email:'buyer@example.test',phone:'0123456789',telegram_chat_id:null};d.customers.push(c);
 d.purchaseOrders.push({id:'po1',customer_id:c.id,business_id,reference:'PO-TEST-001',status:'approved',source_mode:'manual',created_at:new Date().toISOString(),details:{items:[{name:'Box',code:'BOX',quantity:2,unit_price:10,discount:0}],currency:'MYR',order_date:'2026-10-24'}});
 d.quotations.push({id:'q1',purchase_order_id:'po1',business_id,reference:'QT-TEST-001',items:[{name:'Box',code:'BOX',quantity:2,unit_price:10,discount:0}],currency:'MYR',amount:20,payment_terms:'Net 14',delivery_terms:'Pickup',valid_until:'2026-11-24',status:'draft',buyer_decision_note:'',buyer_decision_evidence_id:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 const messages=[];let count=0;
 const gmail={status:()=>({connected:true,email:'seller@example.test',incomingEnabled:true,canRead:true,autoRemindersEnabled:false,automationLiveEnabled:false}),sendMessage:async x=>{messages.push(x);return {id:`s${++count}`,threadId:'test-thread'};},readThread:async()=>inbound};
 const inbound=[];
 const svc=createEmailPhase8({directory:dir,gmail,transaction:fn=>fn(),flush:async()=>{},api:null,businessId:business_id});
 return {svc,d,dir,messages,inbound,clean(){svc.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('quotation/PO email asks for accepted, changes requested, rejected and a reason',async()=>{
 const e=fixture();try{
  const q=e.svc.compose({kind:'quotation',id:'po1'});
  assert.match(q.body,/APPROVED \/ ACCEPTED/);assert.match(q.body,/CHANGES REQUESTED/);assert.match(q.body,/REJECTED/);assert.match(q.body,/reason/);
  e.svc.approveQuotation({quotationId:'q1',confirmed:true});
  await e.svc.sendManual({...q,confirmed:true});
  assert.equal(e.messages.length,1);assert.equal(e.svc.overview().history[0].reference,'QT-TEST-001');
  const po=e.svc.compose({kind:'po',id:'po1'});assert.match(po.body,/PO-TEST-001/);assert.match(po.body,/REJECTED/);
 }finally{e.clean();}
});
test('quotation reply generates seller-review suggestion but never approves quotation',async()=>{
 const e=fixture();try{
  const q=e.svc.compose({kind:'quotation',id:'po1'});e.svc.approveQuotation({quotationId:'q1',confirmed:true});await e.svc.sendManual({...q,confirmed:true});
  e.inbound.push({id:'r-new',internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'Synthetic Buyer <buyer@example.test>'},{name:'Subject',value:'Re: QT-TEST-001'}],mimeType:'text/plain',body:{data:Buffer.from('Please change the price and send a revision.').toString('base64url')}}});
  assert.equal((await e.svc.syncReplies()).imported,1);
  const reply=e.svc.overview().replies[0];assert.equal(reply.category,'revision_requested');assert.equal(reply.document_kind,'quotation');assert.equal(reply.order_id,'po1');assert.equal(reply.review_state,'pending');
  assert.equal(e.d.quotations.find(x=>x.id==='q1').status,'draft');
  assert.ok(e.svc.overview().tasks.some(t=>t.reason.includes('QT-TEST-001')));
  // Dedupe based on Gmail message ID; no repeated seller task.
  assert.equal((await e.svc.syncReplies()).imported,0);
 }finally{e.clean();}
});
test('ambiguous buyer reply is not marked as accepted',async()=>{
 const e=fixture();try{
  await e.svc.sendManual({...e.svc.compose({kind:'po',id:'po1'}),confirmed:true});
  e.inbound.push({id:'ok-new',internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'buyer@example.test'},{name:'Subject',value:'Re: PO-TEST-001'}],mimeType:'text/plain',body:{data:Buffer.from('Okay thanks.').toString('base64url')}}});
  await e.svc.syncReplies();assert.equal(e.svc.overview().replies[0].category,'unclear');
 }finally{e.clean();}
});
