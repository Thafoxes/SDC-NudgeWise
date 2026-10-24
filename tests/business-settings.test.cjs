const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Readable}=require('node:stream');
const {createBackend}=require('../server/app.cjs');
const store=require('../.server-build/lib/store.js');
const {saveBusinessSettings}=require('../.server-build/lib/businessSettings.js');
const customers=require('../.server-build/lib/customerOrders.js');
const workflow=require('../.server-build/lib/orderWorkflow.js');
const {emptyPurchaseOrderDetails}=require('../.server-build/lib/purchaseOrder.js');
const {projectState}=require('../server/mariadb-adapter.cjs');
const actor=['Seller','seller','biz-001'];
const settings={name:'Supplier Ltd',address:'12 Main Street\nKuala Lumpur',phone:'+60312345678',email:'sales@example.test',salesperson_name:'Alice'};
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nw-settings-'));let backend=createBackend({directory,api:{}});
 t.after(()=>{backend.stop();backend.db.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {get backend(){return backend;},reopen(){backend.stop();backend.db.close();backend=createBackend({directory,api:{}});}};}
function command(backend,input,args=actor){return new Promise(resolve=>{
 const req=Readable.from([JSON.stringify({name:'saveBusinessSettings',args:[input,...args]})]);
 Object.assign(req,{method:'POST',url:'/api/command',headers:{host:'127.0.0.1:8787','content-type':'application/json','x-nudgewise-local':'1'}});
 let status;const res={writeHead:code=>status=code,end:text=>resolve({status,body:JSON.parse(text)})};backend.server.emit('request',req,res);
});}
test('seller settings save through the API, survive reopen and project contacts to MariaDB',async t=>{
 const f=fixture(t);const response=await command(f.backend,settings);assert.equal(response.status,200);assert.equal(response.body.result.success,true);
 f.reopen();const business=store.getStore().businesses[0];
 for(const key of Object.keys(settings))assert.equal(business[key],settings[key]);
 const projected=projectState(store.getStore()).businesses[0];
 for(const key of ['name','address','phone','email'])assert.equal(projected[key],settings[key]);
 assert.equal(store.getStore().users[0].name,'Seller','document name does not change authorization identity');
});
test('invalid fields, unauthorized actors and foreign workspace requests cannot change settings',async t=>{
 const f=fixture(t);const before=structuredClone(store.getStore());
 for(const patch of [{name:''},{phone:'x'.repeat(41)},{address:'bad\u0000text'},{email:'not-an-email'},{salesperson_name:'A\nB'}])
  assert.equal((await command(f.backend,{...settings,...patch})).status,400);
 assert.equal((await command(f.backend,settings,['Seller','staff','biz-001'])).status,400);
 assert.equal((await command(f.backend,settings,['Wrong seller','seller','biz-001'])).status,400);
 assert.equal((await command(f.backend,settings,['Seller','seller','other-business'])).status,400);
 assert.deepEqual(store.getStore(),before);
});
test('quotations and invoices retain the salesperson who prepared them after settings change',t=>{
 fixture(t);saveBusinessSettings(settings,...actor);
 const buyer=customers.createCustomer({name:'Buyer',phone:'0123456789',email:''},...actor);
 const details={...emptyPurchaseOrderDetails(),currency:'MYR',items:[{name:'Box',code:'',quantity:2,unit_price:10,discount:0}]};
 const order=customers.createPurchaseOrder(buyer.id,'ORD-SETTINGS',...actor,details,'manual');
 const input={reference:'QT-SETTINGS',currency:'MYR',items:details.items,payment_terms:'',delivery_terms:'',valid_until:''};
 const quote=workflow.saveQuotation(order.id,input,...actor);
 assert.equal(store.getStore().quotations[0].prepared_by,'Alice');
 saveBusinessSettings({...settings,salesperson_name:'Bob'},...actor);
 workflow.saveQuotation(order.id,input,...actor);
 assert.equal(store.getStore().quotations[0].prepared_by,'Alice');
 workflow.setQuotationDecision(quote.id,'accepted','Buyer confirmed',null,...actor);
 assert.equal(customers.approvePurchaseOrder(order.id,...actor).success,true);
 workflow.issueOrderInvoice(order.id,'INV-SETTINGS','2026-10-23','2026-11-22',...actor);
 assert.equal(store.getStore().invoices[0].prepared_by,'Bob');
 saveBusinessSettings({...settings,salesperson_name:'Carol'},...actor);
 assert.equal(store.getStore().quotations[0].prepared_by,'Alice');assert.equal(store.getStore().invoices[0].prepared_by,'Bob');
});
test('browser storage persists settings without a backend and optional fields can be empty',()=>{
 let saved;store.configureStorage({getItem:()=>saved||null,setItem:(_,value)=>saved=value});
 const empty={name:'My seller',address:'',phone:'',email:'',salesperson_name:''};saveBusinessSettings(empty,...actor);
 store.configureStorage({getItem:()=>saved||null,setItem:(_,value)=>saved=value});assert.equal(store.getStore().businesses[0].name,'My seller');
 assert.equal(store.getStore().businesses[0].salesperson_name,'');
});

test('fresh demo company defaults and placeholder migration preserve custom settings and transactions',()=>{
 let saved;const adapter={getItem:()=>saved||null,setItem:(_,value)=>saved=value};store.configureStorage(adapter);
 const fresh=store.getStore();assert.equal(fresh.businesses[0].name,'Kedai Maju Jaya Sdn Bhd');assert.ok(fresh.businesses[0].email.endsWith('.example'));
 assert.equal(fresh.customers.length,0);assert.equal(fresh.invoices.length,0);
 const old=structuredClone(fresh);old.businesses[0]={id:'biz-001',name:'My business',display_name:null,currency:'MYR',timezone:'Asia/Kuala_Lumpur'};
 old.customers.push({id:'manual-buyer',business_id:'biz-001',name:'Actual saved buyer',phone:null,email:null,telegram_chat_id:null});
 saved=JSON.stringify(old);store.configureStorage(adapter);assert.equal(store.getStore().businesses[0].name,'Kedai Maju Jaya Sdn Bhd');assert.equal(store.getStore().customers.length,1);
 old.businesses[0].name='My existing company';old.businesses[0].phone='0123456789';saved=JSON.stringify(old);store.configureStorage(adapter);
 assert.equal(store.getStore().businesses[0].name,'My existing company');assert.equal(store.getStore().businesses[0].phone,'0123456789');
 saveBusinessSettings({name:'My business',address:'',phone:'',email:'',salesperson_name:''},...actor);
 store.configureStorage(adapter);assert.equal(store.getStore().businesses[0].name,'My business');assert.equal(store.getStore().businesses[0].address,'');
});

test('direct orders use our company settings and uploaded PO supplier text stays source evidence',t=>{
 fixture(t);saveBusinessSettings(settings,...actor);
 const buyer=customers.createCustomer({name:'Buyer',phone:'0123456789',email:''},...actor);
 const details={...emptyPurchaseOrderDetails(),currency:'MYR',supplier_name:'Different name on source',supplier_address:'Source address',items:[{name:'Box',code:'',quantity:1,unit_price:10,discount:0}]};
 const direct=customers.createPurchaseOrder(buyer.id,'DIRECT-SETTINGS',...actor,details,'manual');
 const record=store.getStore().purchaseOrders.find(o=>o.id===direct.id);assert.equal(record.details.supplier_name,settings.name);assert.equal(record.details.supplier_address,settings.address);
 assert.equal(record.details.supplier_phone,settings.phone);
 const uploaded=customers.createPurchaseOrder(buyer.id,'UPLOADED-SETTINGS',...actor,details,'uploaded_po');
 assert.equal(store.getStore().purchaseOrders.find(o=>o.id===uploaded.id).details.supplier_name,'Different name on source');
 const revised={...record.details,supplier_name:'Client supplied wrong company'};
 assert.equal(customers.updatePurchaseOrder(direct.id,record.reference,revised,...actor).success,true);
 assert.equal(store.getStore().purchaseOrders.find(o=>o.id===direct.id).details.supplier_name,settings.name);
});

test('company quotation defaults are validated, applied on save and preserve existing quotations',t=>{
 fixture(t);store.setDemoDate('2026-10-24');
 const {quotationDefaults}=require('../.server-build/lib/businessSettings.js');
 assert.equal(quotationDefaults().valid_until,'2026-10-31');
 assert.throws(()=>saveBusinessSettings({...settings,quotation_validity_days:0},...actor),/validity/);
 saveBusinessSettings({...settings,payment_terms:'50% deposit; balance before delivery.',quotation_validity_days:14},...actor);
 const c=customers.createCustomer({name:'Buyer',phone:'0123456789',email:''},...actor);
 const details=emptyPurchaseOrderDetails();details.currency='MYR';details.items=[{name:'Box',code:'',quantity:1,unit_price:100,discount:0}];
 const o=customers.createPurchaseOrder(c.id,'POLICY-PO',...actor,details);
 const q=workflow.saveQuotation(o.id,{reference:'POLICY-Q',items:details.items,currency:'MYR',payment_terms:'',delivery_terms:'Collection',valid_until:''},...actor);
 const saved=store.getStore().quotations.find(x=>x.id===q.id);assert.equal(saved.payment_terms,'50% deposit; balance before delivery.');assert.equal(saved.valid_until,'2026-11-07');
 saveBusinessSettings({...settings,payment_terms:'Cash on delivery',quotation_validity_days:7},...actor);
 assert.equal(store.getStore().quotations.find(x=>x.id===q.id).payment_terms,saved.payment_terms);
});
test('invoice PDFs distinguish paid, credited and unpaid invoices and include digital copy wording',t=>{
 fixture(t);const {invoiceDocument}=require('../.server-build/lib/invoiceDocuments.js');
 const {createDocumentPdf}=require('../.server-build/lib/documentPdf.js');
 store.update(d=>{d.customers.push({id:'pdf-buyer',business_id:'biz-001',name:'Buyer',phone:null,email:null,telegram_chat_id:null});d.invoices.push({id:'pdf-invoice',business_id:'biz-001',customer_id:'pdf-buyer',invoice_number:'PDF-TEST',invoice_amount:100,issue_date:'2026-10-01',due_date:'2026-10-08',status:'paid',labels:[],dispute_active:false,verification_hold:false,promise_to_pay_date:null,promise_confirmed:false,created_at:new Date().toISOString()});});
 const text=()=>{const doc=invoiceDocument(store.getStore(),'pdf-invoice','invoice');return Buffer.from(createDocumentPdf(doc.title,doc.sections)).toString();};
 assert.ok(!text().includes('FULLY PAID'));assert.ok(text().includes('No signature is required.'));
 store.update(d=>d.payments.push({id:'pdf-payment',business_id:'biz-001',invoice_id:'pdf-invoice',amount:100,payment_date:'2026-10-24',method:'cash',reference:'counted',verification_status:'recorded',created_at:new Date().toISOString()}));assert.ok(text().includes('FULLY PAID'));
 store.update(d=>{d.payments=[];d.credits.push({id:'pdf-credit',business_id:'biz-001',invoice_id:'pdf-invoice',amount:100,reason:'Agreed return',created_at:new Date().toISOString()});});assert.ok(!text().includes('FULLY PAID'));assert.ok(text().includes('FULLY SETTLED'));
});
