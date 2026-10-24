const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {Readable}=require('node:stream');
const {createBackend}=require('../server/app.cjs');const store=require('../.server-build/lib/store.js');
const customers=require('../.server-build/lib/customerOrders.js'),workflow=require('../.server-build/lib/orderWorkflow.js');
const actions=require('../.server-build/lib/actions.js'),settlement=require('../.server-build/lib/settlement.js');
const {createQuickSale}=require('../.server-build/lib/quickSale.js');const {projectState}=require('../server/mariadb-adapter.cjs');
const {invoiceDocument}=require('../.server-build/lib/invoiceDocuments.js');const {createDocumentPdf}=require('../.server-build/lib/documentPdf.js');
const actor=['Seller','seller','biz-001'];
function fixture(t,api={}){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nw-quick-sale-'));const backend=createBackend({directory,api});
 t.after(()=>{backend.stop();backend.db.close();fs.rmSync(directory,{recursive:true,force:true});});
 const customer=customers.createCustomer({name:'Buyer',phone:'0123456789',email:''},...actor);
 return {backend,input:{customer_id:customer.id,reference:'INV-POS-1',issue_date:store.getStore().demoState.simulated_date,due_date:'',
 items:[{name:'Box',code:'BOX',quantity:2,unit_price:380,discount:0}],payment_mode:'paid_now',handed_over:true,funds_confirmed:true,
 method:'duitnow',payment_reference:'BANK-760',verification_note:'Verified settled bank credit',override_reason:''}};
}
function command(backend,input,args=actor){return new Promise(resolve=>{const req=Readable.from([JSON.stringify({name:'createQuickSale',args:[input,...args]})]);Object.assign(req,{method:'POST',url:'/api/command',headers:{host:'127.0.0.1:8787','content-type':'application/json','x-nudgewise-local':'1'}});let status;backend.server.emit('request',req,{writeHead:code=>status=code,end:value=>resolve({status,body:JSON.parse(value)})});});}

test('immediate sale records invoice, confirmed handover, payment and receipt without a quotation or buyer PO',async t=>{
 const {backend,input}=fixture(t);const response=await command(backend,input);assert.equal(response.status,200);
 const data=store.getStore(),inv=data.invoices[0],order=data.purchaseOrders[0];
 assert.equal(inv.invoice_amount,760);assert.equal(inv.quotation_id,undefined);assert.equal(data.quotations.length,0);assert.equal(order.source_mode,'quick_sale');
 assert.equal(data.payments.length,1);assert.equal(data.payments[0].amount,760);assert.equal(data.deliveryConfirmations[0].accepted_quantity,2);
 assert.equal(inv.final_receipt.total_paid,760);assert.ok(order.completed_at);assert.deepEqual(settlement.orderCompletionBlockers(order.id),[]);
 const doc=invoiceDocument(data,inv.id,'invoice');assert.ok(Buffer.from(createDocumentPdf(doc.title,doc.sections)).toString().includes('Box'));
 const projected=projectState(data);assert.equal(projected.quotations.length,0);assert.equal(projected.invoices[0].quotation_id,null);
 assert.equal(projected.invoice_items.length,1);assert.equal(projected.invoice_items[0].line_total,760);
 assert.equal(projected.order_stages.find(s=>s.stage_code==='quotation').stage_status,'skipped');assert.equal(projected.order_stages.find(s=>s.stage_code==='receipt').stage_status,'completed');
 assert.equal((await command(backend,input)).status,400);assert.equal(store.getStore().payments.length,1,'retry cannot duplicate collection');
 assert.throws(()=>workflow.saveQuotation(order.id,{},...actor),/Quick sale/);
});
test('pay-later invoice posts no payment even with stale payment checkboxes, then follows existing settlement procedure',t=>{
 const {input}=fixture(t);input.payment_mode='pay_later';input.due_date=input.issue_date;input.handed_over=false;
 const result=createQuickSale(input,...actor);let data=store.getStore();assert.equal(data.payments.length,0);assert.equal(data.settlementReceipts.length,0);assert.equal(data.deliveryConfirmations.length,0);assert.equal(data.invoices[0].final_receipt,undefined);
 assert.equal(store.computeInvoiceWithCustomer(data.invoices[0],data,data.demoState.simulated_date).outstanding_balance,760);
 assert.equal(actions.recordPayment(result.id,760,input.issue_date,'cash','COUNTED','Seller').success,true);
 settlement.issueFinalReceipt(result.id,'Cash received and counted',...actor);assert.throws(()=>settlement.completeOrder(result.order_id,...actor),/delivery/);
 workflow.confirmDelivery(result.order_id,'Box',2,'Customer collected',null,...actor);settlement.completeOrder(result.order_id,...actor);
 assert.ok(store.getStore().purchaseOrders[0].completed_at);
});
test('bad inputs and missing confirmations leave all records unchanged',async t=>{
 const {backend,input}=fixture(t);const before=structuredClone(store.getStore());
 const patches=[{funds_confirmed:false},{handed_over:false},{verification_note:''},{reference:''},{issue_date:'2026-02-30'},
 {issue_date:'2999-01-01'},{payment_mode:'pay_later',due_date:''},{payment_mode:'pay_later',due_date:'2000-01-01'},
 {method:'unknown'},{customer_id:'another-business-customer'},{items:[]},{items:[{...input.items[0],unit_price:null}]},
 {items:[{...input.items[0],quantity:-1}]},{items:[{...input.items[0],discount:999}]},{items:[input.items[0],input.items[0]]}];
 for(const patch of patches){const response=await command(backend,{...input,...patch});assert.equal(response.status,400,JSON.stringify(patch));assert.deepEqual(store.getStore(),before);}
 assert.equal((await command(backend,input,['Seller','staff','biz-001'])).status,400);assert.equal((await command(backend,input,['Seller','seller','other-business'])).status,400);assert.deepEqual(store.getStore(),before);
});
test('an existing customer hold requires an audited one-sale reason and is not cleared',t=>{
 const {input}=fixture(t);
 store.update(d=>d.invoices.push({id:'old-dispute',business_id:'biz-001',customer_id:input.customer_id,invoice_number:'OLD',invoice_amount:10,issue_date:input.issue_date,due_date:input.issue_date,status:'pending',labels:[],dispute_active:true,verification_hold:false,promise_to_pay_date:null,promise_confirmed:false,created_at:new Date().toISOString()}));
 assert.throws(()=>createQuickSale(input,...actor),/on hold/);assert.equal(store.getStore().purchaseOrders.length,0);
 const result=createQuickSale({...input,override_reason:'Seller accepted this cash sale after review'},...actor);
 const data=store.getStore(),order=data.purchaseOrders.find(o=>o.id===result.order_id);assert.equal(order.override.blockers[0].invoice_id,'old-dispute');assert.equal(data.invoices.find(i=>i.id==='old-dispute').dispute_active,true);
 assert.throws(()=>createQuickSale({...input,reference:'INV-POS-2'},...actor),/on hold/);
});
test('direct invoice supports existing delivery-shortfall credit notes without fabricating a quotation',t=>{
 const {input}=fixture(t);const result=createQuickSale({...input,payment_mode:'pay_later',due_date:input.issue_date,handed_over:false},...actor);
 workflow.confirmDelivery(result.order_id,'Box',1,'One box rejected',null,...actor);
 const credit=workflow.issueCreditNote(result.order_id,'Box',1,'Damaged box credited',...actor);assert.equal(credit.amount,380);
 assert.equal(store.computeInvoiceWithCustomer(store.getStore().invoices[0],store.getStore(),input.issue_date).outstanding_balance,380);
});

function upload(backend,url,bytes,name){return new Promise(resolve=>{
 const req=Readable.from([JSON.stringify({name,content:bytes.toString('base64'),actorRole:'seller'})]);
 Object.assign(req,{method:'POST',url,headers:{host:'127.0.0.1:8787','content-type':'application/json','x-nudgewise-local':'1'}});
 let status;backend.server.emit('request',req,{writeHead:code=>status=code,end:value=>resolve({status,body:JSON.parse(value)})});
});}
test('order extraction and payment proof are saved with the quick sale; payment proof never invokes OCR',async t=>{
 let ocrCalls=0,orderCalls=0;
 const {backend,input}=fixture(t,{readDocument:async()=>{ocrCalls++;throw Error('Payment proof must not be processed');},extractQuickSaleOrder:async filename=>{
  orderCalls++;assert.equal(path.extname(filename),'.pdf');return {items:input.items,buyer_name:'Buyer',warnings:[],extracted_text:'Buyer requested two boxes'};
 }});
 const bytes=fs.readFileSync(path.join(__dirname,'fixtures/PO.png'));
 const order=await upload(backend,'/api/quick-sale-document',Buffer.from('%PDF-1.7 synthetic buyer chat'),'order.pdf');
 assert.equal(order.status,200);assert.equal(order.body.result.items[0].unit_price,380);assert.equal(orderCalls,1);
 const proof=await upload(backend,'/api/payment-evidence',bytes,'bank-card.png');assert.equal(proof.status,200);assert.equal(ocrCalls,0);
 assert.equal(store.getStore().payments.length,0,'uploading evidence never records funds');
 const orderEvidence={id:order.body.result.evidence.id,filename:'spoofed',mime_type:'image/png'};
 const paymentEvidence={id:proof.body.result.evidence.id,filename:'spoofed',mime_type:'application/pdf'};
 const sale={...input,order_evidence:orderEvidence,payment_evidence:paymentEvidence,extraction_reviewed:false};
 assert.equal((await command(backend,sale)).status,400);assert.equal(store.getStore().invoices.length,0);
 assert.equal((await command(backend,{...sale,extraction_reviewed:true,funds_confirmed:false})).status,400);
 assert.equal((await command(backend,{...sale,extraction_reviewed:true})).status,200);
 const data=store.getStore();assert.equal(data.orderEvidence.length,2);
 assert.equal(data.orderEvidence.find(e=>e.kind==='payment_proof').filename,'bank-card.png','server uses stored metadata');
 assert.equal(data.payments[0].evidence_id,paymentEvidence.id);
 assert.equal(data.invoices[0].final_receipt.payments[0].evidence_id,paymentEvidence.id);
 const original=backend.db.prepare('SELECT * FROM po_evidence WHERE id = ? AND business_id = ?').get(paymentEvidence.id,'biz-001');assert.deepEqual(Buffer.from(original.bytes),bytes);
});
test('payment proof from another workspace is rejected before any sale is created',async t=>{
 const {backend,input}=fixture(t);const uploaded=await upload(backend,'/api/payment-evidence',Buffer.from('%PDF-1.7 proof'),'bank.pdf');
 const id=uploaded.body.result.evidence.id;
 backend.db.prepare('UPDATE po_evidence SET business_id = ? WHERE id = ?').run('other-business',id);
 assert.equal((await command(backend,{...input,payment_evidence:{id,filename:'bank.pdf',mime_type:'application/pdf'}})).status,400);
 assert.equal(store.getStore().invoices.length,0);assert.equal(store.getStore().payments.length,0);
});
test('pay-later proof remains unverified and can be linked when the seller later records payment',async t=>{
 const {backend,input}=fixture(t);const proof=await upload(backend,'/api/payment-evidence',Buffer.from('%PDF-1.7 bank receipt'),'transfer.pdf');const id=proof.body.result.evidence.id;
 assert.equal((await command(backend,{...input,payment_mode:'pay_later',due_date:input.issue_date,payment_evidence:{id,filename:'transfer.pdf',mime_type:'application/pdf'}})).status,200);
 const invoice=store.getStore().invoices[0];assert.equal(store.getStore().payments.length,0);assert.equal(invoice.final_receipt,undefined);
 assert.equal(actions.recordPayment(invoice.id,760,input.issue_date,'card','CARD','Seller','biz-001','not-linked').success,false);
 assert.equal(actions.recordPayment(invoice.id,760,input.issue_date,'card','CARD','Seller','biz-001',id).success,true);
 assert.equal(store.getStore().payments[0].evidence_id,id);
});
test('failed extraction retains the original and does not replace missing details with sample items',async t=>{
 const {backend}=fixture(t,{extractQuickSaleOrder:async()=>{throw Error('AI unavailable');}});
 const response=await upload(backend,'/api/quick-sale-document',Buffer.from('%PDF-1.7 buyer order'),'order.pdf');
 assert.equal(response.status,200);assert.deepEqual(response.body.result.items,[]);assert.ok(response.body.result.extraction_error);
 assert.ok(response.body.result.evidence.id);assert.equal(store.getStore().purchaseOrders.length,0);
});
test('quick-sale AI proposals validate prices while ordinary chat extraction keeps prices blank',()=>{
 const {validateChatExtraction}=require('../server/integrations.cjs');
 const value={items:[{name:'Box',code:null,quantity:2,unit_price:380,discount:5}],buyer_name:'Buyer',warnings:[]};
 assert.equal(validateChatExtraction(value,'2 Box at 380 discount 5',true).items[0].unit_price,380);
 assert.equal(validateChatExtraction(value,'2 Box',false).items[0].unit_price,null);
 assert.equal(validateChatExtraction({items:[{name:'Box',quantity:2}]},'2 Box',true).items[0].unit_price,null);
 for(const amount of [-1,'380',Infinity,1.123])assert.throws(()=>validateChatExtraction({...value,items:[{...value.items[0],unit_price:amount}]},'Box',true),/invalid prices/);
});
