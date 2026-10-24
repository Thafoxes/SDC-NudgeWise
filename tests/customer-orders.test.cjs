const { test } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../.test-build/lib/store.js');
const orders = require('../.test-build/lib/customerOrders.js');
const actions = require('../.test-build/lib/actions.js');
const seller = 'Siti Aishah', staff = 'Tan Wei Long', biz = 'biz-001';
const reset = () => require('./fixtures/load-business-data.cjs')(store);
const createOrder = (customer = 'cust-03', reference = 'BUYER-PO-1') => orders.createPurchaseOrder(customer, reference, staff, 'staff', biz);

test('phone lookup normalizes Malaysian formats and requires explicit international country codes', () => {
  reset();
  for (const phone of ['0123456789', '+60 12-345 6789', '60123456789', '0060123456789']) {
    assert.equal(orders.normalizePhone(phone), '+60123456789');
    assert.equal(orders.lookupCustomersByPhone(phone)[0].id, 'cust-01');
  }
  assert.equal(orders.normalizePhone('+44 20 7946 0958'), '+442079460958');
  for (const phone of ['', '012', '6012abc3456789', '123456789', '+6012+3456789', null, {}]) assert.throws(() => orders.normalizePhone(phone));
});

test('lookup is business scoped and returns shared-phone ambiguity without silently choosing', () => {
  reset();
  store.update(d => d.customers.push({ ...d.customers[0], id: 'shared-contact' }));
  assert.equal(orders.lookupCustomersByPhone('0123456789').length, 2);
  assert.equal(orders.lookupCustomersByPhone('0123456789', 'biz-002').length, 0);
});

test('create validates fields and rechecks phone so edited OCR output cannot duplicate a customer', () => {
  reset();
  assert.equal(orders.createCustomer({ name: 'Duplicate', phone: '+60123456789', email: '' }, seller, 'seller').success, false);
  assert.equal(orders.createCustomer({ name: 'New buyer', phone: '0171234567', email: 'invalid' }, staff, 'staff').success, false);
  assert.equal(orders.createCustomer({ name: 'New buyer', phone: '0171234567', email: 'buyer@example.test' }, 'unknown', 'seller').success, false);
  assert.equal(orders.createCustomer(null, seller, 'seller').success, false);
  const result = orders.createCustomer({ name: ' New buyer ', phone: '0171234567', email: 'buyer@example.test', address: 'Johor' }, staff, 'staff');
  assert.equal(result.success, true);
  assert.equal(orders.lookupCustomersByPhone('+60171234567')[0].id, result.id);
  assert.equal(orders.lookupCustomersByPhone('0171234567')[0].name, 'New buyer');
});

test('active dispute blocks even when the adjusted balance is zero', () => {
  reset();
  store.update(d => d.credits.push({ id: 'credit', invoice_id: 'inv-1013', business_id: biz, amount: 2900, reason: 'Full credit', created_at: new Date().toISOString() }));
  const eligibility = orders.getOrderEligibility('cust-03');
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.blockers[0].balance, 0);
  assert.match(eligibility.blockers[0].reason, /dispute/i);
});

test('resolving dispute does not bypass settlement; partial, pending and foreign payments do not unlock', () => {
  reset();
  assert.equal(actions.resolveDispute('inv-1013', seller).success, true);
  assert.equal(store.getStore().invoices.find(i => i.id === 'inv-1013').settlement_required, true);
  assert.equal(actions.recordPayment('inv-1013', 100, '2026-10-20', 'demo', '', seller).success, true);
  store.addPayment('inv-1013', 2800, '2026-10-20', 'demo', '', 'pending_verification');
  store.update(d => d.payments.push({ id: 'foreign', invoice_id: 'inv-1013', business_id: 'biz-002', amount: 2800, payment_date: '2026-10-20', verification_status: 'recorded', method: 'demo', reference: null, created_at: new Date().toISOString() }));
  const eligibility = orders.getOrderEligibility('cust-03');
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.blockers[0].balance, 2800);
  assert.equal(actions.recordPayment('inv-1013', 2800, '2026-10-20', 'demo', '', seller).success, true);
  assert.equal(orders.getOrderEligibility('cust-03').allowed, true);
});

test('full approved credit allows order only after dispute resolution; ordinary overdue invoices do not block', () => {
  reset();
  assert.equal(orders.getOrderEligibility('cust-06').allowed, true);
  store.update(d => d.credits.push({ id: 'credit', invoice_id: 'inv-1013', business_id: biz, amount: 2900, reason: 'Full credit', created_at: new Date().toISOString() }));
  assert.equal(orders.getOrderEligibility('cust-03').allowed, false);
  actions.resolveDispute('inv-1013', seller);
  assert.equal(orders.getOrderEligibility('cust-03').allowed, true);
});

test('order gate records buyer PO while blocked and requires seller-only reasoned override', () => {
  reset();
  const created = createOrder();
  assert.equal(created.success, true);
  assert.equal(orders.approvePurchaseOrder(created.id, staff, 'staff', biz, 'Customer exception').success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'staff', biz, 'Customer exception').success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'seller', biz).success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'seller', biz, '   ').success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'seller', biz, 'Deposit agreed for this order').success, true);
  const saved = store.getStore().purchaseOrders.find(o => o.id === created.id);
  assert.equal(saved.override.blockers[0].invoice_id, 'inv-1013');
  assert.equal(saved.override.actor, seller);
  assert.ok(saved.override.approved_at);
  assert.equal(saved.override.reason, 'Deposit agreed for this order');
  assert.equal(store.getStore().invoices.find(i => i.id === 'inv-1013').dispute_active, true);
  const next = createOrder('cust-03', 'BUYER-PO-2');
  assert.equal(orders.approvePurchaseOrder(next.id, seller, 'seller', biz).success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'seller', biz, 'Again').success, false);
  assert.equal(store.getStore().activityEvents.filter(e => e.event_type === 'purchase_order_override').length, 1);
});

test('approval rechecks newly raised disputes instead of trusting the earlier screen', () => {
  reset();
  const created = createOrder('cust-06');
  assert.equal(orders.getOrderEligibility('cust-06').allowed, true);
  store.updateInvoice('inv-1006', { dispute_active: true });
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'seller', biz).success, false);
  actions.resolveDispute('inv-1006', seller);
  assert.equal(orders.getOrderEligibility('cust-06').allowed, false);
});

test('order commands reject foreign customer/order, duplicate PO reference and invalid arguments', () => {
  reset();
  assert.equal(createOrder('cust-delta').success, false);
  assert.equal(orders.getOrderEligibility('cust-delta').allowed, false);
  const created = createOrder('cust-06');
  assert.equal(createOrder('cust-06', ' buyer-po-1 ').success, false);
  assert.equal(createOrder('cust-06', null).success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, 'Rajesh Kumar', 'seller', 'biz-002').success, false);
  assert.equal(orders.approvePurchaseOrder(created.id, seller, 'seller', biz).success, true);
  assert.equal(store.getStore().purchaseOrders[0].override, undefined);
});

test('legacy snapshots retain historical dispute obligations and migrate without deleting records', () => {
  reset();
  const snapshot = structuredClone(store.getStore());
  delete snapshot.purchaseOrders;
  const invoice = snapshot.invoices.find(i => i.id === 'inv-1013');
  delete invoice.settlement_required;
  invoice.dispute_active = false;
  const memory = new Map([['nudgewise-demo-v1.1', JSON.stringify(snapshot)]]);
  store.configureStorage({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) });
  assert.equal(orders.getOrderEligibility('cust-03').allowed, false);
  assert.equal(store.getStore().customers.length, snapshot.customers.length);
  assert.deepEqual(store.getStore().purchaseOrders, []);
  createOrder();
  store.configureStorage({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) });
  assert.equal(store.getStore().purchaseOrders.length, 1);
  assert.equal(orders.getOrderEligibility('cust-03').allowed, false);
  store.configureStorage(undefined);
});
