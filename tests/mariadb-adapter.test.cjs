const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {Readable} = require('node:stream');
const { MemoryDb, projectState, tableOrder } = require('../server/mariadb-adapter.cjs');
const {createBackend} = require('../server/app.cjs');
const store = require('../.server-build/lib/store.js');
const orders = require('../.server-build/lib/customerOrders.js');
const po = require('../.server-build/lib/purchaseOrder.js');
const workflow = require('../.server-build/lib/orderWorkflow.js');

const actor=['Seller','seller','biz-001'];
function request(backend, url, body=null, method=body?'POST':'GET') {
  return new Promise(resolve=>{
    const req=Readable.from(body?[JSON.stringify(body)]:[]);
    Object.assign(req,{method,url,headers:{host:'127.0.0.1:8787','content-type':'application/json','x-nudgewise-local':'1'}});
    let code=0;
    const res={headersSent:false,writeHead(status){code=status;this.headersSent=true;},end(text){resolve({status:code,data:JSON.parse(text)});}};
    backend.server.emit('request',req,res);
  });
}

test('MemoryDb reads and rolls back state and evidence without a SQLite database file',()=>{
  const db=new MemoryDb();
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE state(x TEXT);');
  const set=db.prepare('INSERT INTO state VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value');
  set.run('nudgewise-demo-v1.1','test');
  assert.equal(db.prepare('SELECT value FROM state WHERE id = ?').get('nudgewise-demo-v1.1').value,'test');
  db.exec('BEGIN IMMEDIATE');set.run('nudgewise-demo-v1.1','changed');db.exec('ROLLBACK');
  assert.equal(db.prepare('SELECT value FROM state WHERE id = ?').get('nudgewise-demo-v1.1').value,'test');
  const bytes=Buffer.from('evidence');
  db.prepare('INSERT INTO po_evidence VALUES (?, ?, ?, ?, ?, ?, ?)').run('uuid','biz-001','chat.png','image/png',bytes,'sha','2026-10-23T10:00:00Z');
  assert.equal(db.prepare('SELECT id FROM po_evidence WHERE id=? AND business_id=?').get('uuid','biz-001').id,'uuid');
  assert.equal(db.prepare('SELECT * FROM po_evidence WHERE id = ? AND business_id = ?').get('uuid','biz-001').bytes.toString(),'evidence');
});

test('NudgeWise HTTP commands persist through the MariaDB adapter seam',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nudgewise-mariadb-test-'));
  const db=new MemoryDb();let writes=0;
  const persist=async()=>{writes++;assert.ok(db.tables.state.get('nudgewise-demo-v1.1')?.value);};
  const backend=createBackend({directory:dir,database:db,persist,api:{}});
  t.after(()=>{backend.stop();fs.rmSync(dir,{recursive:true,force:true});});
  const initial=await request(backend,'/api/state');
  assert.equal(initial.status,200);
  assert.equal(initial.data.integration.dbClient,'mariadb');
  const customer=await request(backend,'/api/command',{name:'createCustomer',args:[{name:'Demo Customer',phone:'0121234567',email:'customer@example.test'},...actor]});
  assert.equal(customer.status,200);
  assert.equal(customer.data.result.success,true);
  const details=po.emptyPurchaseOrderDetails();details.currency='MYR';details.items=[{name:'Box',code:'',quantity:10,unit_price:null,discount:0}];
  const order=await request(backend,'/api/command',{name:'createPurchaseOrder',args:[customer.data.result.id,'PO-NEW-001',...actor,details,'chat_screenshot']});
  assert.equal(order.status,200);
  assert.equal(order.data.result.success,true);
  assert.ok(writes>=3);
  assert.equal(fs.existsSync(path.join(dir,'demo.sqlite')),false);
  const normalized=projectState(JSON.parse(db.tables.state.get('nudgewise-demo-v1.1').value));
  assert.equal(normalized.customers.length,1);
  assert.equal(normalized.purchase_orders.length,1);
  assert.equal(normalized.purchase_order_items.length,1);
  const reopened=createBackend({directory:dir,database:db,persist});
  t.after(()=>reopened.stop());
  assert.equal(reopened.snapshot().purchaseOrders[0].reference,'PO-NEW-001');
});

test('Projected order-payment data satisfies MariaDB schema column and FK requirements',()=>{
  let raw;
  store.configureStorage({getItem:()=>raw??null,setItem:(_,v)=>{raw=v;}});
  store.getStore();
  const customer=orders.createCustomer({name:'Buyer Sdn Bhd',phone:'0123456789',email:'buyer@example.test'},...actor);
  const details=po.emptyPurchaseOrderDetails();
  Object.assign(details,{currency:'MYR',items:[{name:'Box A',code:'',quantity:50,unit_price:null,discount:0}]});
  const order=orders.createPurchaseOrder(customer.id,'PO-DEMO-001',...actor,details,'chat_screenshot');
  orders.approvePurchaseOrder(order.id,...actor);
  const q=workflow.saveQuotation(order.id,{reference:'QT-DEMO-001',currency:'MYR',payment_terms:'Net 30',delivery_terms:'Delivery required',valid_until:'2026-12-20',items:[{name:'Box A',code:'',quantity:50,unit_price:10,discount:0}]},...actor);
  workflow.setQuotationDecision(q.id,'accepted','Buyer approval recorded by seller',null,...actor);
  assert.equal(orders.approvePurchaseOrder(order.id,...actor).success,true);
  const inv=workflow.issueOrderInvoice(order.id,'INV-DEMO-001','2026-10-23','2026-11-22',...actor);
  const claim=workflow.createPaymentClaim(inv.id,500,'REF-123',null,...actor);
  workflow.reviewPaymentClaim(claim.id,true,'Bank confirmed',...actor);
  const projected=projectState(store.getStore());
  assert.equal(projected.payments.length,1);
  assert.equal(projected.payment_claims.length,1);
  assert.equal(projected.receipts.length,1);
  assert.equal(projected.order_stages.length,7);
  const schema=fs.readFileSync(path.join(__dirname,'../database/MARIADB_SCHEMA_REFERENCE_ONLY_NOT_CONNECTED.sql'),'utf8');
  const definitions=new Map();const fks=[];
  for(const block of schema.split(/CREATE TABLE IF NOT EXISTS /).slice(1)){
    const table=block.match(/^`(\w+)`/)[1];
    definitions.set(table,new Map([...block.matchAll(/^  `(\w+)` ([A-Z]+(?:\(\d+(?:,\d+)?\))?)(.*)$/gm)].map(m=>[m[1],{type:m[2],text:m[3]}])));
    for(const match of block.matchAll(/FOREIGN KEY \(([^)]+)\) REFERENCES `(\w+)` \(([^)]+)\)/g))
      fks.push({table,keys:[...match[1].matchAll(/`(\w+)`/g)].map(m=>m[1]),parent:match[2],parentKeys:[...match[3].matchAll(/`(\w+)`/g)].map(m=>m[1])});
  }
  assert.equal(tableOrder(fks.map(f=>[f.table,f.parent])).length,29);
  for(const [table,rows] of Object.entries(projected))for(const row of rows){
    const cols=definitions.get(table);assert.ok(cols,`Schema table ${table}`);
    for(const [k,v] of Object.entries(row)){
      const def=cols.get(k);assert.ok(def,`${table}.${k} exists`);
      const len=def.type.match(/^(?:VARCHAR|CHAR)\((\d+)\)/);
      if(v!=null && len)assert.ok(String(v).length<=Number(len[1]),`${table}.${k} too long`);
    }
    for(const [k,d] of cols) if(/\bNOT NULL\b/.test(d.text)&&!/^.*DEFAULT\b/.test(d.text))
      assert.ok(row[k]!=null,`${table}.${k} is required`);
  }
  for(const fk of fks)for(const row of projected[fk.table]) {
    const vals=fk.keys.map(k=>row[k]);if(vals.some(v=>v==null))continue;
    assert.ok(projected[fk.parent].some(parent=>fk.parentKeys.every((k,i)=>parent[k]===vals[i])),
      `FK ${fk.table}(${fk.keys}) -> ${fk.parent}(${fk.parentKeys})`);
  }
});
