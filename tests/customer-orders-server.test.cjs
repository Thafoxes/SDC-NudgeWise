const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createBackend } = require('../server/app.cjs');
const { validateCustomerExtraction } = require('../server/integrations.cjs');

function request(backend, url, body, headers = {}) {
  return new Promise(resolve => {
    const req = Readable.from([JSON.stringify(body)]);
    Object.assign(req, { method: 'POST', url, headers: { host: '127.0.0.1:8787', 'content-type': 'application/json', 'x-nudgewise-local': '1', ...headers } });
    let status;
    const res = { writeHead: code => { status = code; }, end: value => resolve({ status, body: JSON.parse(value) }) };
    backend.server.emit('request', req, res);
  });
}

function fixture(t, extractCustomer = async () => ({ name: 'Buyer Ltd', phone: '0123456789', email: null, address: null })) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgewise-customer-test-'));
  const backend = createBackend({ directory, api: { extractCustomer } });
  require('./fixtures/load-business-data.cjs')(require('../.server-build/lib/store.js'));
  t.after(() => {
    backend.stop(); backend.db.close();
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('nudgewise-customer-test-'));
    fs.rmSync(directory, { recursive: true });
  });
  return { backend, directory };
}
const upload = () => ({ name: 'po.pdf', content: Buffer.from('%PDF-1.7 synthetic buyer PO').toString('base64'), actorRole: 'staff' });

test('customer OCR returns reviewed suggestions without creating a customer and removes temporary files', async t => {
  let temporary;
  const { backend, directory } = fixture(t, async filename => {
    temporary = filename;
    assert.equal(fs.readFileSync(filename, 'utf8'), '%PDF-1.7 synthetic buyer PO');
    return { name: ' Buyer Ltd ', phone: '0123456789', email: null, address: null };
  });
  const count = backend.snapshot().customers.length;
  const result = await request(backend, '/api/customer-document', upload());
  assert.equal(result.status, 200);
  assert.equal(result.body.result.name, 'Buyer Ltd');
  assert.equal(backend.snapshot().customers.length, count);
  assert.equal(fs.existsSync(temporary), false);
  assert.equal(fs.readdirSync(directory).some(name => name.startsWith('customer-')), false);
});

test('customer OCR rejects invalid format, role, origin, oversized bytes and malformed base64 before extraction', async t => {
  let calls = 0;
  const { backend } = fixture(t, async () => { calls++; throw new Error('Must not extract'); });
  for (const [patch, headers, expected] of [
    [{ content: Buffer.from('not PDF').toString('base64') }, {}, 400],
    [{ actorRole: 'customer' }, {}, 403],
    [{ content: '%%%=' }, {}, 400],
    [{ content: Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString('base64') }, {}, 413],
    [{}, { origin: 'https://untrusted.example' }, 403],
    [{}, { 'x-nudgewise-local': '' }, 403],
  ]) assert.equal((await request(backend, '/api/customer-document', { ...upload(), ...patch }, headers)).status, expected);
  assert.equal(calls, 0);
});

test('extraction failure removes temporary uploads and creates no customer', async t => {
  const { backend, directory } = fixture(t, async () => { throw new Error('OCR unavailable'); });
  assert.equal((await request(backend, '/api/customer-document', upload())).status, 400);
  assert.equal(fs.readdirSync(directory).some(name => name.startsWith('customer-')), false);
});

test('customer upload follows the shared demo access guard', async t => {
  const prior = process.env.DEMO_ACCESS_KEY;
  process.env.DEMO_ACCESS_KEY = 'synthetic-test-key';
  t.after(() => { if (prior === undefined) delete process.env.DEMO_ACCESS_KEY; else process.env.DEMO_ACCESS_KEY = prior; });
  const { backend } = fixture(t);
  assert.equal((await request(backend, '/api/customer-document', upload())).status, 401);
  assert.equal((await request(backend, '/api/customer-document', upload(), { 'x-demo-key': 'synthetic-test-key' })).status, 200);
});

test('customer extraction rejects invented shapes and oversized or control-character fields', () => {
  for (const value of [null, [], {}, { name: 42, phone: null, email: null, address: null },
    { name: 'x'.repeat(201), phone: null, email: null, address: null },
    { name: 'Buyer\nInstructions', phone: null, email: null, address: null }])
    assert.throws(() => validateCustomerExtraction(value), /Invalid/);
});

test('customer extraction requires OCR evidence for every proposed field', () => {
  const value = { name: 'Buyer Ltd', phone: '+60 12-345 6789', email: 'buyer@example.test', address: '12 Main Street' };
  const text = 'Buyer Ltd\n+60 12 345 6789\nbuyer@example.test\n12 Main Street';
  assert.deepEqual(validateCustomerExtraction(value, text), value);
  for (const field of Object.keys(value)) {
    assert.throws(() => validateCustomerExtraction({ ...value, [field]: 'Invented customer detail' }, text), /not supported by the OCR/);
  }
  assert.throws(() => validateCustomerExtraction(value, '<!-- image -->'), /not supported by the OCR/);
  assert.throws(() => validateCustomerExtraction({ name: null, phone: null, email: null, address: null }, text), /No customer details/);
});

test('customer commands cannot target a different business or create customers as a buyer', async t => {
  const { backend } = fixture(t);
  const input = { name: 'Buyer Ltd', phone: '0123456789', email: null, address: null };
  const foreign = await request(backend, '/api/command', { name: 'createCustomer', args: [input, 'Seller', 'seller', 'other-business'] });
  assert.equal(foreign.body.result.success, false);
  const buyer = await request(backend, '/api/command', { name: 'createCustomer', args: [input, 'Buyer', 'customer', backend.snapshot().businesses[0].id] });
  assert.equal(buyer.body.result.success, false);
});

test('server rechecks disputes and restricts a recorded override to one order', async t => {
  const { backend } = fixture(t);
  const data = backend.snapshot();
  const seller = data.users.find(user => user.role === 'seller');
  const staff = data.users.find(user => user.role === 'staff');
  const invoice = data.invoices.find(item => item.dispute_active && item.business_id === seller.business_id);
  assert.ok(invoice, 'fixture contains a disputed invoice');
  const command = async (name, args) => (await request(backend, '/api/command', { name, args })).body.result;
  const created = await command('createPurchaseOrder', [invoice.customer_id, 'PO-BACKEND-1', seller.name, seller.role, seller.business_id]);
  assert.equal(created.success, true);
  assert.equal((await command('approvePurchaseOrder', [created.id, seller.name, seller.role, seller.business_id])).success, false);
  assert.equal((await command('approvePurchaseOrder', [created.id, staff.name, staff.role, staff.business_id, 'Not authorized'])).success, false);
  assert.equal((await command('approvePurchaseOrder', [created.id, seller.name, seller.role, seller.business_id, 'Deposit required before dispatch'])).success, true);
  const approved = backend.snapshot().purchaseOrders.find(order => order.id === created.id);
  assert.equal(approved.override.reason, 'Deposit required before dispatch');
  assert.equal(approved.override.blockers[0].invoice_id, invoice.id);
  const next = await command('createPurchaseOrder', [invoice.customer_id, 'PO-BACKEND-2', seller.name, seller.role, seller.business_id]);
  assert.equal((await command('approvePurchaseOrder', [next.id, seller.name, seller.role, seller.business_id])).success, false);
  assert.equal(backend.snapshot().invoices.find(item => item.id === invoice.id).dispute_active, true);
});
