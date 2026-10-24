const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {Readable}=require('node:stream');
const {createBackend}=require('../server/app.cjs');const core=require('../.server-build/lib/store.js');
const customers=require('../.server-build/lib/customerOrders.js'),workflow=require('../.server-build/lib/orderWorkflow.js');
const actions=require('../.server-build/lib/actions.js'),settlement=require('../.server-build/lib/settlement.js');
const {emptyPurchaseOrderDetails}=require('../.server-build/lib/purchaseOrder.js');const {invoiceDocument}=require('../.server-build/lib/invoiceDocuments.js');
const {createDocumentPdf}=require('../.server-build/lib/documentPdf.js');const {projectState}=require('../server/mariadb-adapter.cjs');
const actor=['Seller','seller','biz-001'];
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nw-settlement-'));const backend=createBackend({directory,api:{}});
 t.after(()=>{backend.stop();backend.db.close();fs.rmSync(directory,{recursive:true,force:true});});
 const customer=customers.createCustomer({name:'Buyer',phone:'0123456789',email:''},...actor);
 const details={...emptyPurchaseOrderDetails(),currency:'MYR',items:[{name:'Box',code:'BOX',quantity:2,unit_price:380,discount:0}]};
 const order=customers.createPurchaseOrder(customer.id,'ORD-760',...actor,details,'manual');
 const quote=workflow.saveQuotation(order.id,{reference:'QT-760',currency:'MYR',items:details.items,payment_terms:'Net 7',delivery_terms:'Delivery agreed',valid_until:''},...actor);
 workflow.setQuotationDecision(quote.id,'accepted','Buyer agreed',null,...actor);assert.equal(customers.approvePurchaseOrder(order.id,...actor).success,true);
 const invoice=workflow.issueOrderInvoice(order.id,'INV-760','2026-10-23','2026-10-30',...actor);
 return {backend,orderId:order.id,invoiceId:invoice.id};
}
function pay(id,amount=760){assert.equal(actions.recordPayment(id,amount,'2026-10-23','duitnow','BANK-760','Seller').success,true);}
function command(backend,name,args){return new Promise(resolve=>{const req=Readable.from([JSON.stringify({name,args})]);Object.assign(req,{method:'POST',url:'/api/command',headers:{host:'127.0.0.1:8787','content-type':'application/json','x-nudgewise-local':'1'}});let status;backend.server.emit('request',req,{writeHead:code=>status=code,end:value=>resolve({status,body:JSON.parse(value)})});});}

test('manual invoice payment can issue an idempotent final receipt and only complete after delivery',async t=>{
 const f=fixture(t);pay(f.invoiceId);
 assert.equal(core.getStore().settlementReceipts.length,0,'reproduces missing legacy receipt');
 let result=await command(f.backend,'issueFinalReceipt',[f.invoiceId,'Checked DuitNow settlement against bank statement',...actor]);
 assert.equal(result.status,200);assert.equal(core.getStore().payments.length,1,'does not post another payment');
 assert.equal(core.getStore().settlementReceipts.length,1);
 const number=core.getStore().invoices[0].final_receipt.number;
 settlement.issueFinalReceipt(f.invoiceId,'Bank confirmed',...actor);assert.equal(core.getStore().invoices[0].final_receipt.number,number);assert.equal(core.getStore().settlementReceipts.length,1);
 assert.equal((await command(f.backend,'completeOrder',[f.orderId,...actor])).status,400);
 workflow.confirmDelivery(f.orderId,'Box',2,'Buyer accepted both boxes',null,...actor);
 assert.equal((await command(f.backend,'completeOrder',[f.orderId,...actor])).status,200);
 settlement.completeOrder(f.orderId,...actor);assert.equal(core.getStore().activityEvents.filter(e=>e.event_type==='order_completed').length,1);
 const projected=projectState(core.getStore());assert.equal(projected.receipts.length,1);
 assert.equal(projected.order_stages.find(s=>s.stage_code==='receipt').stage_status,'completed');
 const doc=invoiceDocument(core.getStore(),f.invoiceId,'final_receipt');const text=Buffer.from(createDocumentPdf(doc.title,doc.sections)).toString();
 for(const word of ['FINAL PAYMENT RECEIPT','760.00','duitnow','BANK-760','Checked DuitNow'])assert.ok(text.includes(word),word);
});
test('final receipts reject partial, unverified, disputed and unauthorized settlements',async t=>{
 const f=fixture(t);
 assert.throws(()=>settlement.issueFinalReceipt(f.invoiceId,'Checked bank',...actor),/remaining payment/);
 pay(f.invoiceId,200);assert.throws(()=>settlement.issueFinalReceipt(f.invoiceId,'Checked bank',...actor),/remaining payment/);pay(f.invoiceId,560);
 for(const patch of [{verification_hold:true},{dispute_active:true}]){
  core.update(d=>Object.assign(d.invoices[0],patch));assert.throws(()=>settlement.issueFinalReceipt(f.invoiceId,'Checked bank',...actor),/review|dispute/);
  core.update(d=>Object.assign(d.invoices[0],{verification_hold:false,dispute_active:false}));
 }
 assert.throws(()=>settlement.issueFinalReceipt(f.invoiceId,'',...actor),/Enter how/);
 assert.equal((await command(f.backend,'issueFinalReceipt',[f.invoiceId,'Checked bank','Seller','staff','biz-001'])).status,400);
 assert.equal((await command(f.backend,'issueFinalReceipt',[f.invoiceId,'Checked bank','Seller','seller','other-business'])).status,400);
 assert.equal(core.getStore().invoices[0].final_receipt,undefined);
});
test('pending claims block final receipts even when a legacy invoice hold is missing',t=>{
 const f=fixture(t);workflow.createPaymentClaim(f.invoiceId,760,'CLAIM',null,...actor);pay(f.invoiceId);
 core.update(d=>{d.invoices[0].verification_hold=false;});assert.throws(()=>settlement.issueFinalReceipt(f.invoiceId,'Checked bank',...actor),/pending payment/);
});
test('debit notes reopen settlement and historical receipts do not complete the new balance',t=>{
 const f=fixture(t);pay(f.invoiceId);workflow.confirmDelivery(f.orderId,'Box',2,'Accepted',null,...actor);
 settlement.issueFinalReceipt(f.invoiceId,'Checked bank',...actor);settlement.completeOrder(f.orderId,...actor);
 const original=structuredClone(core.getStore().invoices[0].final_receipt);
 workflow.issueDebitNote(f.orderId,'Delivery charge',50,'Buyer agreed extra trip',...actor);
 assert.equal(settlement.hasCurrentFinalReceipt(core.getStore().invoices[0],core.getStore()),false);
 assert.notEqual(projectState(core.getStore()).order_stages.find(s=>s.stage_code==='receipt').stage_status,'completed');
 assert.throws(()=>settlement.completeOrder(f.orderId,...actor),/remaining payment/);pay(f.invoiceId,50);
 assert.throws(()=>settlement.completeOrder(f.orderId,...actor),/final receipt/);
 settlement.issueFinalReceipt(f.invoiceId,'Checked additional payment',...actor);
 assert.equal(core.getStore().invoices[0].final_receipt.total_paid,810);
 assert.equal(core.getStore().settlementReceipts.length,2,'one receipt per payment preserves SQL uniqueness');
 assert.deepEqual(core.getStore().activityEvents.find(e=>e.event_type==='final_receipt_issued').metadata.previous_final_receipt,original);
 settlement.completeOrder(f.orderId,...actor);
});
test('credit-only settlement prints a settlement statement without claiming cash received',t=>{
 const f=fixture(t);workflow.confirmDelivery(f.orderId,'Box',0,'Buyer rejected both damaged boxes',null,...actor);
 workflow.issueCreditNote(f.orderId,'Box',2,'Both boxes credited',...actor);
 settlement.issueFinalReceipt(f.invoiceId,'Seller confirmed full credit; no payment received',...actor);
 const doc=invoiceDocument(core.getStore(),f.invoiceId,'final_receipt');assert.equal(doc.title,'FINAL SETTLEMENT STATEMENT');
 assert.equal(core.getStore().invoices[0].final_receipt.total_paid,0);assert.equal(core.getStore().settlementReceipts.length,0);
 settlement.completeOrder(f.orderId,...actor);
});
