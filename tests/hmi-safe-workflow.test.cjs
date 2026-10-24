'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=p=>fs.readFileSync(path.join(root,p),'utf8');
const store=require('../.server-build/lib/store.js');
const {createEmailPhase8}=require('../server/email-phase8.cjs');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nw-hmi-sec-'));
 const map=new Map();store.configureStorage({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)});
 const d=store.getStore(),biz=store.DEMO_BUSINESS_ID;
 d.customers.push({id:'hmi-c',business_id:biz,name:'Test Buyer',email:'buyer@example.test',phone:'0123456789'});
 d.purchaseOrders.push({id:'hmi-o',business_id:biz,customer_id:'hmi-c',reference:'PO-HMI-2026',status:'approved',source_mode:'manual',created_at:'2026-10-24T00:00:00Z',details:{items:[{name:'Box',quantity:1,unit_price:10,discount:0}],currency:'MYR',order_date:'2026-10-24'}});
 d.quotations.push({id:'hmi-q',purchase_order_id:'hmi-o',business_id:biz,reference:'QT-HMI-2026',items:[{name:'Box',quantity:1,unit_price:10,discount:0}],currency:'MYR',amount:10,payment_terms:'14 days',delivery_terms:'Pickup',valid_until:'2026-11-24',status:'draft',created_at:'2026-10-24T00:00:00Z',updated_at:'2026-10-24T00:00:00Z'});
 const sent=[],inbound=[];
 const gmail={status:()=>({connected:true,canRead:true,incomingEnabled:true,email:'seller@example.test'}),sendMessage:async m=>{sent.push(m);return {id:`m-${sent.length}`,threadId:`thread-${sent.length}`}},readThread:async id=>inbound.filter(m=>m.threadId===id)};
 const email=createEmailPhase8({directory:dir,gmail,transaction:cb=>cb(),flush:async()=>{},api:null,businessId:biz});
 return {d,email,sent,inbound,cleanup(){email.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('server rejects quotation PDF email without current seller issuance approval',async()=>{
 const f=fixture();try{
  const mail=f.email.compose({kind:'quotation',id:'hmi-o',mode:'await_reply'});
  await assert.rejects(f.email.sendManual({...mail,confirmed:true}),/Approve the current quotation version/i);
  assert.equal(f.sent.length,0);assert.equal(f.email.overview().history.length,0);
  f.email.approveQuotation({quotationId:'hmi-q',confirmed:true});
  await f.email.sendManual({...mail,confirmed:true});assert.equal(f.sent.length,1);
  store.update(d=>{d.quotations.find(q=>q.id==='hmi-q').items[0].unit_price=12;});
  await assert.rejects(f.email.sendManual({...mail,confirmed:true}),/Approve the current quotation version/i);
  assert.equal(f.sent.length,1);
 }finally{f.cleanup();}
});
test('reply to superseded quotation is stored as stale and never confirms an approval',async()=>{
 const f=fixture();try{
  f.email.approveQuotation({quotationId:'hmi-q',confirmed:true});
  const mail=f.email.compose({kind:'quotation',id:'hmi-o',mode:'await_reply'});
  await f.email.sendManual({...mail,confirmed:true});
  store.update(d=>{d.quotations.find(q=>q.id==='hmi-q').amount=15;});
  f.inbound.push({id:'reply-old',threadId:'thread-1',internalDate:String(Date.now()),payload:{mimeType:'text/plain',headers:[{name:'From',value:'buyer@example.test'},{name:'Subject',value:'Re: QT-HMI-2026'}],body:{data:Buffer.from('APPROVED').toString('base64url')}}});
  assert.equal((await f.email.syncReplies()).imported,1);
  const reply=f.email.overview().replies[0];assert.equal(reply.review_state,'stale');assert.ok(reply.document_stamp);
  assert.notEqual(f.d.quotations.find(q=>q.id==='hmi-q').status,'accepted');
 }finally{f.cleanup();}
});
test('Orders submenu matches agreed business workflow order',()=>{
 const ui=src('src/components/AppSidebar.vue');
 const seq=['All Orders','Purchase Orders','Quotations','Invoices','Direct Orders'].map(x=>ui.indexOf(`label:'${x}'`));
 assert.ok(seq.every(x=>x>=0)&&seq.every((x,i)=>!i||x>seq[i-1]));
});
test('HMI uses action-first navigation and keeps detailed Orders view',()=>{
 const action=src('src/views/ActionCenterView.vue');
 assert.match(action,/Needs My Action/);assert.match(action,/Awaiting Buyer/);assert.match(action,/Communications/);
 const orders=src('src/views/OrdersView.vue');
 assert.match(orders,/Simple view/);assert.match(orders,/Detailed view/);assert.match(orders,/progressColumns/);
});
test('shareable exporter excludes private paths by allowlist',()=>{
 const e=src('tools/export_shareable_source.py');assert.match(e,/allowed_roots/);assert.match(e,/\.local-data/);assert.match(e,/\.env/);
});
