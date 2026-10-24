const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createBackend } = require('../server/app.cjs');
const core = require('../.server-build/lib/store.js');
const customers = require('../.server-build/lib/customerOrders.js');
const po = require('../.server-build/lib/purchaseOrder.js');
const workflow = require('../.server-build/lib/orderWorkflow.js');

const actor = ['Seller', 'seller', 'biz-001'];
const balance = () => core.computeInvoiceWithCustomer(core.getStore().invoices[0], core.getStore(), '2026-10-23').outstanding_balance;

// 100 boxes quoted at RM 5 and accepted by the buyer; delivery not yet recorded.
function acceptedOrder(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgewise-credit-'));
  const backend = createBackend({ directory: dir });
  t.after(() => { backend.stop(); backend.db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const customer = customers.createCustomer({ name: 'Cafe Bunga', phone: '0123456789', email: 'finance@bunga.test' }, ...actor);
  const details = po.emptyPurchaseOrderDetails();
  Object.assign(details, { currency: 'MYR', items: [{ name: 'Kuih box', code: '', quantity: 100, unit_price: null, discount: 0 }], document_total: null });
  const order = customers.createPurchaseOrder(customer.id, 'ORD-1', ...actor, details, 'chat_screenshot');
  assert.equal(customers.approvePurchaseOrder(order.id, ...actor).success, true);
  const q = workflow.saveQuotation(order.id, { reference: 'QT-1', currency: 'MYR', payment_terms: '30 days', delivery_terms: '', valid_until: '',
    items: [{ name: 'Kuih box', code: '', quantity: 100, unit_price: 5, discount: 0 }] }, ...actor);
  workflow.setQuotationDecision(q.id, 'accepted', 'Accepted by WhatsApp', null, ...actor);
  assert.equal(customers.approvePurchaseOrder(order.id,...actor).success,true);
  return { backend, orderId: order.id };
}
const mismatch = id => workflow.deriveOrderBlockers(id).find(b => b.kind === 'quantity_mismatch');
function command(backend, name, args) { return new Promise(resolve => {
  const req = Readable.from([JSON.stringify({ name, args })]);
  Object.assign(req, { method: 'POST', url: '/api/command', headers: { host: '127.0.0.1:8787', 'content-type': 'application/json', 'x-nudgewise-local': '1' } });
  let status; const res = { writeHead: code => { status = code; }, end: body => resolve({ status, result: JSON.parse(body) }) }; backend.server.emit('request', req, res);
}); }

test('80 of 100 accepted blocks invoicing until a credit note covers the 20; the invoice then owes RM 400', t => {
  const { orderId } = acceptedOrder(t);
  workflow.confirmDelivery(orderId, 'Kuih box', 80, 'DO-551: 20 damaged', null, ...actor);
  assert.equal(mismatch(orderId).shortfall, 20);
  assert.throws(() => workflow.issueOrderInvoice(orderId, 'INV-1', '2026-10-23', '2026-11-22', ...actor), /Resolve blocker/);
  assert.throws(() => workflow.issueCreditNote(orderId, 'Kuih box', 21, 'Damaged', ...actor), /exceed the shortfall \(20\)/);
  assert.throws(() => workflow.issueCreditNote(orderId, 'Kuih box', 20, ' ', ...actor), /reason/);
  assert.throws(() => workflow.issueCreditNote(orderId, 'Kuih box', 20, 'Damaged', 'Staff', 'staff', 'biz-001'), /Seller approval/);
  const note = workflow.issueCreditNote(orderId, 'Kuih box', 20, '20 boxes damaged in delivery', ...actor);
  assert.deepEqual([note.number, note.amount], ['CN-ORD-1-1', 100]);
  assert.equal(mismatch(orderId), undefined);
  const inv = workflow.issueOrderInvoice(orderId, 'INV-1', '2026-10-23', '2026-11-22', ...actor);
  assert.equal(inv.success, true);
  assert.equal(core.getStore().invoices[0].invoice_amount, 500, 'the original amount is kept');
  assert.equal(balance(), 400);
  assert.equal(core.getStore().creditNotes[0].invoice_id, inv.id);
  assert.throws(() => workflow.confirmDelivery(orderId, 'Kuih box', 100, 'Late delivery', null, ...actor), /cannot exceed the ordered quantity/);
});

test('a credit note after invoicing lowers the balance at once and cancels reminders drafted for the old amount', t => {
  const { orderId } = acceptedOrder(t);
  workflow.confirmDelivery(orderId, 'Kuih box', 90, 'All good at the time', null, ...actor);
  workflow.acceptDeliveryShortfall(orderId, 'Kuih box', 'Buyer will collect the last 10 boxes', ...actor);
  const inv = workflow.issueOrderInvoice(orderId, 'INV-2', '2026-10-23', '2026-11-22', ...actor);
  core.update(d => { d.followUpActions.push({ id: 'fu-test', business_id: 'biz-001', invoice_id: inv.id, customer_id: d.invoices[0].customer_id,
    checkpoint: 2, message: 'Please pay RM 500', message_version: 1, approval_state: 'approved', send_state: 'not_sent', approved_by: 'Seller',
    approved_at: '2026-10-23T00:00:00Z', approved_message_hash: 'x', recipient: '+60123456789', delivery_status: null, created_at: '2026-10-23T00:00:00Z' }); });
  workflow.issueCreditNote(orderId, 'Kuih box', 10, 'Buyer returned 10 boxes', ...actor);
  assert.equal(balance(), 450);
  const fu = core.getStore().followUpActions.find(f => f.id === 'fu-test');
  assert.deepEqual([fu.approval_state, fu.send_state], ['cancelled', 'cancelled']);
});

test('"no change" clears the blocker with a recorded reason, and a later delivery resets that decision', t => {
  const { orderId } = acceptedOrder(t);
  workflow.confirmDelivery(orderId, 'Kuih box', 80, 'Partial', null, ...actor);
  assert.throws(() => workflow.acceptDeliveryShortfall(orderId, 'Kuih box', '', ...actor), /reason/);
  workflow.acceptDeliveryShortfall(orderId, 'Kuih box', 'Buyer agreed to pay in full; rest arrives next week', ...actor);
  assert.equal(mismatch(orderId), undefined);
  workflow.confirmDelivery(orderId, 'Kuih box', 85, 'Second count', null, ...actor);
  assert.equal(mismatch(orderId).shortfall, 15);
  assert.ok(core.getStore().activityEvents.some(e => e.event_type === 'delivery_shortfall_accepted'));
});

test('the server accepts both commands only for this business', async t => {
  const { backend, orderId } = acceptedOrder(t);
  workflow.confirmDelivery(orderId, 'Kuih box', 80, 'Partial', null, ...actor);
  const wrong = await command(backend, 'issueCreditNote', [orderId, 'Kuih box', 20, 'Damaged', 'Seller', 'seller', 'biz-999']);
  assert.notEqual(wrong.status, 200);
  const ok = await command(backend, 'issueCreditNote', [orderId, 'Kuih box', 20, 'Damaged', ...actor]);
  assert.equal(ok.status, 200);
  assert.equal(ok.result.result.amount, 100);
});

test('a debit note adds agreed charges after invoicing, reopens a paid invoice and cancels old reminders', t => {
  const { orderId } = acceptedOrder(t);
  workflow.confirmDelivery(orderId, 'Kuih box', 100, 'All accepted', null, ...actor);
  assert.throws(() => workflow.issueDebitNote(orderId, 'Second trip', 30, 'Buyer asked', ...actor), /Create the invoice/);
  const inv = workflow.issueOrderInvoice(orderId, 'INV-3', '2026-10-23', '2026-11-22', ...actor);
  assert.throws(() => workflow.issueDebitNote(orderId, 'Second trip', 30, 'Buyer asked', 'Staff', 'staff', 'biz-001'), /Seller approval/);
  assert.throws(() => workflow.issueDebitNote(orderId, 'Second trip', -5, 'Buyer asked', ...actor), /positive amount/);
  assert.throws(() => workflow.issueDebitNote(orderId, 'Second trip', 30, '', ...actor), /reason/);
  core.update(d => { d.followUpActions.push({ id: 'fu-old', business_id: 'biz-001', invoice_id: inv.id, customer_id: d.invoices[0].customer_id,
    checkpoint: 2, message: 'Please pay RM 500', message_version: 1, approval_state: 'pending', send_state: 'not_sent', approved_by: null,
    approved_at: null, approved_message_hash: null, recipient: '+60123456789', delivery_status: null, created_at: '2026-10-23T00:00:00Z' }); });
  const note = workflow.issueDebitNote(orderId, 'Second delivery trip', 30, 'Buyer asked for a second drop-off on 24 Oct', ...actor);
  assert.equal(note.number, 'DN-ORD-1-1');
  assert.equal(balance(), 530);
  assert.equal(core.getStore().invoices[0].invoice_amount, 500, 'the original amount is kept');
  assert.equal(core.getStore().followUpActions.find(f => f.id === 'fu-old').approval_state, 'cancelled');
  const claim = workflow.createPaymentClaim(inv.id, 500, 'BANK-1', null, ...actor);
  workflow.reviewPaymentClaim(claim.id, true, 'Bank statement checked', ...actor);
  assert.equal(balance(), 30, 'paying the original amount leaves the debit note open');
  assert.equal(core.computeStatus(core.getStore().invoices[0], core.getStore(), '2026-10-23'), 'pending');
});
