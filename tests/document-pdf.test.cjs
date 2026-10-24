const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDocumentPdf,documentContactSections}=require('../.test-build/lib/documentPdf.js');
const {emptyPurchaseOrderDetails}=require('../.test-build/lib/purchaseOrder.js');
const business={name:'Seller Ltd',display_name:null,address:'20 Seller Road',phone:'+60987654321',email:'sales@example.test'};
const customer={name:'Buyer Ltd',address:'12 Main Road',phone:'+60123456789',email:'buyer@example.test'};
const details={...emptyPurchaseOrderDetails(),supplier_address:'20 Seller Road',supplier_phone:'+60987654321',supplier_email:'sales@example.test'};
const item={name:'Packing box',code:'BOX-1',quantity:20,unit_price:38,discount:5};

test('all document layouts include buyer and supplier contacts and a bordered item table',()=>{
 for(const title of ['QUOTATION','INVOICE TRACKING COPY','ORDER SUMMARY FOR BUYER REVIEW']){
  const bytes=createDocumentPdf(title,[...documentContactSections(business,customer,details),{heading:'Items (MYR)',lines:[],items:[item]}]);
  const text=Buffer.from(bytes).toString();
  for(const value of ['Buyer Ltd','12 Main Road','+60123456789','20 Seller Road','+60987654321','Packing box','755.00','Unit price','Line total'])assert.ok(text.includes(value),value);
  assert.ok(text.includes(' re S'),'table borders');
  const start=Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(start,start+4),'xref');
  const entries=text.slice(start).split('\n');
  const count=Number(entries[1].split(' ')[1]);
  for(let i=1;i<count;i++)assert.equal(text.slice(Number(entries[i+2].slice(0,10))).startsWith(`${i} 0 obj`),true);
 }
});
test('missing contacts render dashes, while buyer contacts can fall back to the order',()=>{
 const missing=documentContactSections(undefined,undefined);
 assert.ok(missing.every(section=>section.lines.every(line=>line.endsWith(': -'))));
 const fallback=documentContactSections(business,undefined,{...details,buyer_address:'PO address',buyer_phone:'0123456789',buyer_name:'PO buyer'});
 assert.ok(fallback[1].lines.includes('Phone: 0123456789'));
 assert.ok(fallback[1].lines.includes('Address: PO address'));
});
test('long multi-page item tables repeat headers and retain the last row',()=>{
 const items=Array.from({length:100},(_,i)=>({...item,name:`Item ${i+1}: ${'Long product description '.repeat(8)}`}));
 const text=Buffer.from(createDocumentPdf('QUOTATION',[{heading:'Items',lines:[],items}])).toString();
 assert.ok((text.match(/\(Unit price\)/g)||[]).length>1);
 assert.ok(text.includes('Item 100:'));
 assert.ok(text.includes('Page 2 of'));
});
test('unpriced items use dashes instead of inventing zero values',()=>{
 const text=Buffer.from(createDocumentPdf('ORDER',[{heading:'Items',lines:[],items:[{...item,unit_price:null}]}])).toString();
 assert.ok(text.includes('(-) Tj'));
 assert.equal(text.includes('(0.00) Tj'),false);
});

test('saved seller contacts take precedence over uploaded PO supplier fields',()=>{
 const sections=documentContactSections({...business,address:'Saved seller address',phone:'Saved phone',email:'seller@example.test'},customer,details);
 assert.ok(sections[0].lines.includes('Address: Saved seller address'));
 assert.ok(sections[0].lines.includes('Phone: Saved phone'));
 assert.ok(sections[0].lines.includes('Email: seller@example.test'));
});

test('an empty saved company contact does not print a different supplier from the buyer PO',()=>{
 const sections=documentContactSections({name:'Our company',display_name:null,address:'',phone:'',email:''},customer,details);
 assert.ok(sections[0].lines.includes('Address: -'));assert.ok(sections[0].lines.includes('Phone: -'));
});
