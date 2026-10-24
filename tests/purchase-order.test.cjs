const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const { createBackend } = require('../server/app.cjs');
const store = require('../.server-build/lib/store.js');
const orders = require('../.server-build/lib/customerOrders.js');
const po = require('../.server-build/lib/purchaseOrder.js');
const integrations = require('../server/integrations.cjs');
const sample = require('./fixtures/business-data.json');

const original = fs.readFileSync(path.join(__dirname, 'fixtures/PO.png'));
function extraction() {
  const details = po.emptyPurchaseOrderDetails();
  Object.assign(details, { order_date: '2017-04-26', delivery_date: '2017-04-28', buyer_name: 'PurchaseControl',
    supplier_name: 'Taylor Dickens', supplier_email: 'john@taylordickens.com', payment_terms: '30 Days',
    delivery_address: 'Boston Office, One Post Office Square, Suite 3600, Boston MA, 02109, USA', delivery_phone: '800-504-3364',
    document_status: 'Closed Completed', requested_by: 'Patrick Smith', document_approved_by: 'Patrick Smith', department: 'IT Department',
    items: [[1,34.99],[1,20.49],[15,1.90],[3,23.89],[5,3.59],[2,15.49],[1,23.89]].map(([quantity,unit_price],i)=>({ name: i===3||i===6 ? '3 Tier Letter Tray' : `Item ${i+1}`, code: `CODE-${i}`, quantity, unit_price, discount: 0 })), document_total: 228.47 });
  return { reference: 'PO00495', details };
}
function request(backend, method, url, body, headers = {}) {
  return new Promise(resolve => {
    const req = Readable.from(body ? [JSON.stringify(body)] : []);
    Object.assign(req, { method, url, headers: { host: '127.0.0.1:8787', 'content-type': 'application/json', 'x-nudgewise-local': '1', ...headers } });
    let status, responseHeaders;
    const res = { writeHead: (code, h) => { status = code; responseHeaders = h; }, end: bytes => resolve({ status, headers: responseHeaders, body: responseHeaders['Content-Type'] === 'application/json' ? JSON.parse(bytes) : Buffer.from(bytes) }) };
    backend.server.emit('request', req, res);
  });
}
const upload = () => ({ name: 'PO.png', content: original.toString('base64'), actorRole: 'seller' });
function fixture(t, extractPurchaseOrder = async () => extraction()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgewise-po-'));
  const backend = createBackend({ directory, api: { extractPurchaseOrder } });
  let closed = false;
  const close = () => { if (!closed) { backend.stop(); backend.db.close(); closed = true; } };
  t.after(() => { close(); assert.equal(path.dirname(directory), os.tmpdir()); assert.ok(path.basename(directory).startsWith('nudgewise-po-')); fs.rmSync(directory, { recursive: true }); });
  return { backend, directory, close };
}

test('fresh workspace has no dummy transactions, and reset never restores samples', t => {
  const { backend } = fixture(t);
  for (const key of ['customers','invoices','payments','credits','purchaseOrders','followUpActions','customerResponses','activityEvents','notifications','aiConversations']) assert.deepEqual(backend.snapshot()[key], [], key);
  assert.equal(store.resetStore().customers.length, 0);
  assert.equal(store.getStore().users[0].name, 'Seller');
});

test('legacy cleanup backs up original state, removes samples and preserves manually entered customers', () => {
  const legacy = structuredClone(sample);
  delete legacy.sample_data_removed;
  legacy.customers.push({ id: 'manual-customer', business_id: 'biz-001', name: 'My actual buyer', phone: '+60123400000', email: null, telegram_chat_id: null });
  const memory = new Map([['nudgewise-demo-v1.1', JSON.stringify(legacy)]]);
  store.configureStorage({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k,v) });
  assert.deepEqual(store.getStore().customers.map(c=>c.id), ['manual-customer']);
  assert.deepEqual(store.getStore().invoices, []);
  assert.deepEqual(JSON.parse(memory.get('nudgewise-demo-v1.1-before-sample-cleanup')), legacy);
  store.configureStorage(undefined);
});

test('legacy backend cleanup uses table keys when old sent payloads have no id', t => {
  const { DatabaseSync } = require('node:sqlite');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgewise-po-'));
  const legacy = structuredClone(sample); delete legacy.sample_data_removed;
  const db = new DatabaseSync(path.join(directory, 'demo.sqlite'));
  db.exec('CREATE TABLE state (id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE sent (id TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE receipts (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  db.prepare('INSERT INTO state VALUES (?,?)').run('nudgewise-demo-v1.1',JSON.stringify(legacy));
  db.prepare('INSERT INTO sent VALUES (?,?)').run('message-key',JSON.stringify({invoice_id:'inv-1006',customer_id:'cust-06',message_id:900}));
  db.close();
  const backend = createBackend({directory,api:{}});
  t.after(()=>{backend.stop();backend.db.close();assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('nudgewise-po-'));fs.rmSync(directory,{recursive:true});});
  assert.equal(backend.db.prepare('SELECT COUNT(*) AS n FROM sent').get().n,0);
  assert.equal(backend.snapshot().customers.length,0);
  assert.ok(backend.db.prepare('SELECT value FROM state WHERE id=?').get('before-sample-cleanup:sent').value.includes('inv-1006'));
});

test('PO PNG evidence is stored as exact SQLite BLOB and is retrievable after reopen', async t => {
  const { backend, directory, close } = fixture(t);
  const result = await request(backend, 'POST', '/api/purchase-order-document', upload());
  assert.equal(result.status, 200);
  const { reference, details, evidence } = result.body.result;
  assert.equal(reference, 'PO00495');
  assert.equal(details.items.length, 7);
  assert.equal(details.currency, '', 'bare dollar sign leaves currency unconfirmed');
  assert.equal(details.supplier_email, 'john@taylordickens.com');
  assert.equal(details.buyer_email, '');
  assert.equal(po.purchaseOrderTotal(details.items), 228.47);
  assert.equal(evidence.sha256, createHash('sha256').update(original).digest('hex'));
  const row = backend.db.prepare('SELECT bytes FROM po_evidence WHERE id = ?').get(evidence.id);
  assert.deepEqual(Buffer.from(row.bytes), original);
  const customer = orders.createCustomer({ name: 'PurchaseControl', phone: '+18005043364', email: '' }, 'Seller', 'seller');
  details.currency = 'USD'; details.evidence_id = evidence.id;
  const saved = await request(backend, 'POST', '/api/command', { name:'createPurchaseOrder', args:[customer.id,reference,'Seller','seller','biz-001',details] });
  assert.equal(saved.body.result.success, true);
  assert.equal(backend.snapshot().purchaseOrders[0].status, 'draft', 'printed Closed Completed is not app approval');
  assert.equal(backend.snapshot().purchaseOrders[0].details.evidence_id, evidence.id);
  assert.equal((await request(backend, 'POST', '/api/purchase-order-document', upload())).body.result.evidence.id, evidence.id);
  assert.equal(backend.db.prepare('SELECT COUNT(*) AS n FROM po_evidence').get().n, 1);
  const download = await request(backend, 'GET', `/api/po-evidence/${evidence.id}`);
  assert.equal(download.headers['Content-Type'], 'image/png');
  assert.deepEqual(download.body, original);
  close();
  const reopened = createBackend({ directory, api: {} });
  assert.deepEqual((await request(reopened, 'GET', `/api/po-evidence/${evidence.id}`)).body, original);
  assert.equal(reopened.snapshot().purchaseOrders[0].details.items.length, 7);
  reopened.stop(); reopened.db.close();
});

test('OCR failure preserves original evidence and returns a manual-entry path', async t => {
  const { backend, directory } = fixture(t, async () => { throw new Error('Model unavailable'); });
  const result = await request(backend, 'POST', '/api/purchase-order-document', upload());
  assert.equal(result.status, 200);
  assert.match(result.body.result.extraction_error, /manually/);
  assert.equal(result.body.result.reference, '');
  assert.deepEqual((await request(backend, 'GET', `/api/po-evidence/${result.body.result.evidence.id}`)).body, original);
  assert.ok(!fs.readdirSync(directory).some(n => n.startsWith('customer-')));
});

test('evidence cannot be attached or retrieved from a different workspace', async t => {
  const { backend } = fixture(t);
  const { evidence } = (await request(backend, 'POST', '/api/purchase-order-document', upload())).body.result;
  backend.db.prepare('UPDATE po_evidence SET business_id = ? WHERE id = ?').run('another-business', evidence.id);
  assert.equal((await request(backend,'GET',`/api/po-evidence/${evidence.id}`)).status, 404);
  const details = extraction().details; details.currency = 'USD'; details.evidence_id = evidence.id;
  const result = await request(backend,'POST','/api/command',{name:'createPurchaseOrder',args:['any','PO-1','Seller','seller','biz-001',details]});
  assert.equal(result.body.result.success, false);
  assert.match(result.body.result.error, /evidence/);
});

test('PO details require confirmed currency, valid quantities and non-negative line totals', () => {
  const details = extraction().details;
  assert.throws(()=>po.validatePurchaseOrderDetails(details), /currency/);
  details.currency = 'USD';
  assert.equal(po.purchaseOrderTotal(po.validatePurchaseOrderDetails(details).items), 228.47);
  for (const invalid of [null, -1, 0, Infinity]) assert.throws(()=>po.validatePurchaseOrderDetails({...details,items:[{...details.items[0],quantity:invalid}]}), /quantity/);
  assert.throws(()=>po.validatePurchaseOrderDetails({...details,items:[{...details.items[0],discount:999}]}), /discount/);
  assert.throws(()=>po.validatePurchaseOrderDetails({...details,delivery_date:'2017-02-30'}), /dates/);
});

test('draft edits persist but mismatched totals prevent approval and approved PO cannot be edited', t => {
  fixture(t);
  const customer = orders.createCustomer({ name:'Buyer',phone:'+60122220000',email:'' },'Seller','seller');
  const details = extraction().details; details.currency = 'USD';
  const order = orders.createPurchaseOrder(customer.id,'PO00495','Seller','seller','biz-001',details);
  assert.equal(order.success,true);
  assert.equal(orders.updatePurchaseOrder(order.id,'PO00495',{...details,document_total:999},'Seller','seller').success,true);
  assert.equal(orders.approvePurchaseOrder(order.id,'Seller','seller').success,false);
  assert.equal(orders.updatePurchaseOrder(order.id,'PO00495',details,'Seller','seller').success,true);
  assert.equal(orders.approvePurchaseOrder(order.id,'Seller','seller').success,true);
  assert.equal(orders.updatePurchaseOrder(order.id,'CHANGED',details,'Seller','seller').success,false);
});

test('seller can confirm a total mismatch through the API with an audited one-order reason', async t => {
  const { backend } = fixture(t);
  const customer = orders.createCustomer({name:'Buyer',phone:'+60122220000',email:''},'Seller','seller');
  const details = {...extraction().details, currency:'MYR', document_total:999};
  const order = orders.createPurchaseOrder(customer.id,'DIRECT-001','Seller','seller','biz-001',details,'manual');
  const approve = (role, business, reason) => request(backend,'POST','/api/command',{
    name:'approvePurchaseOrder',args:[order.id,'Seller',role,business,reason]});
  for (const reason of ['', '   ', 'x'.repeat(501)])
    assert.equal((await approve('seller','biz-001',reason)).body.result.success,false);
  assert.equal((await approve('staff','biz-001','Reviewed difference')).body.result.success,false);
  assert.equal((await approve('seller','other-business','Reviewed difference')).body.result.success,false);
  assert.equal(store.getStore().purchaseOrders[0].status,'draft');
  const reason = 'Buyer ordered directly; seller reviewed the original total difference';
  assert.equal((await approve('seller','biz-001',reason)).body.result.success,true);
  const saved = store.getStore().purchaseOrders.find(o=>o.id===order.id);
  assert.equal(saved.status,'approved');
  assert.equal(saved.override.reason,reason);
  assert.deepEqual(saved.override.total_mismatch,{calculated:228.47,printed:999});
  assert.equal(saved.details.document_total,999);
  assert.equal(store.getStore().activityEvents.find(e=>e.event_type==='purchase_order_override').metadata.override.reason,reason);
  const next = orders.createPurchaseOrder(customer.id,'DIRECT-002','Seller','seller','biz-001',details,'manual');
  assert.equal(orders.approvePurchaseOrder(next.id,'Seller','seller').success,false);
});
