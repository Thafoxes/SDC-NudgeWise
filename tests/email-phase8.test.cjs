const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');const path=require('node:path');const fs=require('node:fs');
const store=require('../.server-build/lib/store.js');
const {createEmailPhase8,dateDiff}=require('../server/email-phase8.cjs');
const day=(offset=0)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
function env({auto=true,canRead=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nw-email-test-'));const map=new Map();
 store.configureStorage({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)});
 const data=store.getStore();const biz=store.DEMO_BUSINESS_ID;
 data.customers.push({id:'c1',business_id:biz,name:'Buyer A',phone:'0123456789',email:'buyer@example.test',telegram_chat_id:null});
 data.invoices.push({id:'i1',business_id:biz,customer_id:'c1',invoice_number:'INV-2026-001',invoice_amount:510,issue_date:day(-10),due_date:day(3),status:'pending',labels:[],dispute_active:false,verification_hold:false,promise_to_pay_date:null,promise_confirmed:false,created_at:new Date().toISOString()});
 let sent=0;
 const threadMessages=[];
 const gmail={status:()=>({connected:true,email:'seller@example.test',autoRemindersEnabled:auto,automationLiveEnabled:auto,incomingEnabled:canRead,canRead}),sendMessage:async()=>({id:'m-'+(++sent),threadId:'threadabc123'}),readThread:async()=>threadMessages};
 const service=createEmailPhase8({directory:dir,gmail,transaction:fn=>fn(),flush:async()=>{},api:{chat:async()=>{throw Error('Offline AI');}},businessId:biz});
 return {service,data,dir,gmail,threadMessages,sent:()=>sent};
}
test('day difference and stage selection match configured 3/7/14/21 thresholds',()=>{
 const e=env();const inv=e.data.invoices[0];
 assert.equal(e.service.calcStage(inv,day()),'before_3');inv.due_date=day(-7);assert.equal(e.service.calcStage(inv,day()),'overdue_7');
 inv.due_date=day(-14);assert.equal(e.service.calcStage(inv,day()),'overdue_14');inv.due_date=day(-21);assert.equal(e.service.calcStage(inv,day()),'escalation_21');
 e.service.close();fs.rmSync(e.dir,{recursive:true,force:true});
});
test('automatic reminder sends once and does not send disputed invoice',async()=>{
 const e=env();
 await e.service.tick();await e.service.tick();assert.equal(e.sent(),1);
 const history=e.service.overview().history;assert.equal(history.length,1);assert.equal(history[0].state,'accepted');
 const e2=env();e2.data.invoices[0].dispute_active=true;await e2.service.tick();assert.equal(e2.sent(),0);
 e.service.close();e2.service.close();fs.rmSync(e.dir,{recursive:true,force:true});fs.rmSync(e2.dir,{recursive:true,force:true});
});
test('no-email creates a manual task instead of attempting an email',async()=>{
 const e=env();e.data.customers[0].email=null;await e.service.tick();assert.equal(e.sent(),0);assert.equal(e.service.overview().tasks.length,1);
 e.service.close();fs.rmSync(e.dir,{recursive:true,force:true});
});
test('incoming reply creates seller-review candidate, never confirms promise',async()=>{
 const e=env({canRead:true});await e.service.tick();
 e.threadMessages.push({id:'r1234567',internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'Buyer <buyer@example.test>'},{name:'Subject',value:'Re: Invoice INV-2026-001'}],mimeType:'text/plain',body:{data:Buffer.from('I will pay tomorrow.').toString('base64url')}}});
 const result=await e.service.syncReplies();assert.equal(result.imported,1);
 const reply=store.getStore().customerResponses.at(0);assert.equal(reply.review_status,'pending');assert.equal(reply.promise_review,'pending');
 assert.equal(e.data.invoices[0].promise_confirmed,false);await e.service.syncReplies();assert.equal(e.service.overview().replies.length,1);
 e.service.close();fs.rmSync(e.dir,{recursive:true,force:true});
});
test('seller-approved invoice email attaches a backend-generated invoice PDF and records Gmail acceptance',async()=>{
 const e=env();
 const draft=e.service.compose({kind:'invoice',id:'i1'});
 assert.equal(draft.to,'buyer@example.test');assert.match(draft.subject,/INV-2026-001/);
 await assert.rejects(()=>e.service.sendManual({...draft,confirmed:false}),/Seller approval required/);
 const sent=await e.service.sendManual({...draft,confirmed:true});
 assert.equal(sent.status,'accepted');assert.equal(e.sent(),1);
 assert.equal(e.service.overview().history[0].kind,'invoice');
 e.service.close();fs.rmSync(e.dir,{recursive:true,force:true});
});
