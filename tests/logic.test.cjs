/** Regression tests for local Phase 1/2 business logic. Run: npm run test:logic */
const { test } = require('node:test');
const assert = require('node:assert/strict');
// Built output is CommonJS, even though the Vue app itself uses ESM.
const path = require('node:path');
const root = path.join(__dirname, '..', '.test-build', 'lib');
const store = require(path.join(root, 'store.js'));
const reminder = require(path.join(root, 'reminderEngine.js'));
const actions = require(path.join(root, 'actions.js'));
const priority = require(path.join(root, 'priorityEngine.js'));
const mem = new Map();
global.localStorage = {
  getItem: key => mem.get(key) ?? null,
  setItem: (key, val) => mem.set(key, String(val)),
  removeItem: key => mem.delete(key),
};
const reset = () => { require('./fixtures/load-business-data.cjs')(store); store.setDemoDate('2026-10-20'); };
const biz = 'biz-001';
const sellerId = 'user-seller', seller = 'Siti Aishah';
const getFu = () => store.getStore().followUpActions.find(f => f.id === 'fu-001');

test('checkpoint dates: before due versus overdue are not reversed', () => {
  reset();
  const inv = store.getStore().invoices.find(i => i.id === 'inv-1006');
  assert.equal(reminder.determineCheckpoint({ ...inv, status:'pending' }, '2026-10-16').checkpoint, 1);
  assert.equal(reminder.determineCheckpoint(inv, '2026-10-20').checkpoint, 2);
  assert.equal(reminder.determineCheckpoint(inv, '2026-11-11').checkpoint, 5);
});
test('rejected checkpoint is not regenerated', () => {
  reset();
  assert.equal(actions.rejectFollowUp('fu-001', seller,'seller').success, true);
  reminder.runInvoiceCheck();
  assert.equal(store.getStore().followUpActions.filter(f => f.invoice_id === 'inv-1006' && f.checkpoint === 2).length, 1);
});
test('missed promise alerts only once and expired promise no longer pauses', () => {
  reset();
  const inv = store.getStore().invoices.find(i => i.id === 'inv-1016');
  assert.equal(reminder.isReminderPaused(inv,'2026-10-14').paused, true);
  assert.equal(reminder.isReminderPaused(inv,'2026-10-20').paused, false);
  reminder.runInvoiceCheck(); reminder.runInvoiceCheck();
  assert.equal(store.getStore().activityEvents.filter(e => e.invoice_id === 'inv-1016' && e.event_type === 'missed_promise').length, 1);
});
test('21+ day escalation checkpoint persists and is idempotent', () => {
  reset(); reminder.runInvoiceCheck(); reminder.runInvoiceCheck();
  assert.equal(store.getStore().followUpActions.filter(f => f.invoice_id==='inv-1016' && f.checkpoint===5).length,1);
});
test('staff and cross-business sellers cannot approve, real demo seller can', () => {
  reset();
  assert.equal(actions.approveFollowUp('fu-001', 'user-staff','Tan Wei Long','seller').success, false);
  assert.equal(actions.approveFollowUp('fu-001','user-seller2','Rajesh Kumar','seller').success,false);
  assert.equal(actions.approveFollowUp('fu-001',sellerId,seller,'seller').success,true);
});
test('recipient change invalidates approval before simulated send', () => {
  reset();
  assert.equal(actions.approveFollowUp('fu-001',sellerId,seller,'seller').success,true);
  store.updateFollowUp('fu-001',{recipient:'another-person'});
  assert.equal(actions.sendApprovedFollowUp('fu-001',seller).success,false);
  assert.equal(getFu().approval_state,'cancelled');
});
test('message/invoice data changes invalidate approved snapshot', () => {
  reset();
  assert.equal(actions.approveFollowUp('fu-001',sellerId,seller,'seller').success,true);
  store.updateInvoice('inv-1006',{invoice_amount:1850});
  assert.equal(actions.sendApprovedFollowUp('fu-001',seller).success,false);
  assert.equal(getFu().send_state,'cancelled');
});
test('simulated send is exactly once', () => {
  reset();
  assert.equal(actions.approveFollowUp('fu-001',sellerId,seller,'seller').success,true);
  assert.equal(actions.sendApprovedFollowUp('fu-001',seller).success,true);
  assert.equal(actions.sendApprovedFollowUp('fu-001',seller).success,false);
  assert.equal(store.getStore().activityEvents.filter(e=>e.event_type==='reminder_simulated' && e.invoice_id==='inv-1006').length,1);
});
test('payment claims / disputes hold and cancel stale reminders, never mark Paid', () => {
  reset();
  const reply=actions.simulateCustomerResponse('inv-1006','cust-06','Boss I already paid yesterday');
  assert.equal(reply.success,true);
  assert.equal(getFu().send_state,'cancelled');
  assert.equal(store.getStore().invoices.find(i=>i.id==='inv-1006').verification_hold,true);
  assert.notEqual(store.computeStatus(store.getStore().invoices.find(i=>i.id==='inv-1006'),store.getStore(),'2026-10-20'),'paid');
  reset();
  assert.equal(actions.simulateCustomerResponse('inv-1006','cust-06','I never received my order').success,true);
  assert.equal(store.getStore().invoices.find(i=>i.id==='inv-1006').dispute_active,true);
  assert.equal(getFu().send_state,'cancelled');
});
test('payment: reject overpayment; reduce balance; settle; prevent send', () => {
  reset();
  assert.equal(actions.recordPayment('inv-1006',1801,'2026-10-20','demo','',seller).success,false);
  assert.equal(actions.recordPayment('inv-1006',500,'2026-10-20','demo','',seller).success,true);
  assert.equal(store.computeInvoiceWithCustomer(store.getStore().invoices.find(i=>i.id==='inv-1006'),store.getStore(),'2026-10-20').outstanding_balance,1300);
  assert.equal(actions.recordPayment('inv-1006',1300,'2026-10-20','demo','',seller).success,true);
  assert.equal(store.getStore().invoices.find(i=>i.id==='inv-1006').status,'paid');
  assert.equal(actions.sendApprovedFollowUp('fu-001',seller).success,false);
});
test('unauthorized cross-business mutations fail', () => {
  reset();
  assert.equal(actions.recordPayment('inv-delta-001',100,'2026-10-20','demo','',seller,biz).success,false);
  assert.equal(actions.rejectFollowUp('fu-001','Rajesh Kumar','seller',biz).success,false);
  assert.equal(actions.confirmPromise('inv-delta-001','2026-10-25',true,seller,biz).success,false);
});
test('customer priority uses recorded history: green, yellow, red, grey + review flags', () => {
  reset();
  const p = priority.calculateCustomerPriorities(biz);
  const by=id=>p.find(item=>item.customerId===id);
  assert.equal(by('cust-green').level,'green');
  assert.equal(by('cust-yellow').level,'yellow');
  assert.equal(by('cust-yellow').lateCount,2);
  assert.equal(by('cust-06').level,'red');
  assert.equal(by('cust-grey').level,'grey');
  assert.equal(by('cust-04').level,'grey');
  assert.ok(by('cust-04').reviewFlags.some(flag=>flag.includes('verification')));
  assert.ok(by('cust-yellow').supportingInvoiceIds.length>0);
});
test('priorities recalculate after seller records a change in status', () => {
  reset();
  const before=priority.calculateCustomerPriorities(biz).find(x=>x.customerId==='cust-06');
  assert.equal(before.level,'red');
  assert.equal(actions.recordPayment('inv-1006',1800,'2026-10-20','demo','',seller).success,true);
  assert.equal(actions.recordPayment('inv-1016',4200,'2026-10-20','demo','',seller).success,true);
  const after=priority.calculateCustomerPriorities(biz).find(x=>x.customerId==='cust-06');
  assert.notEqual(after.level,'red');
});
