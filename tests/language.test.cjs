/** Smart reminders: tone follows the stage, language follows the customer. Run: npm run test:logic */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', '.test-build', 'lib');
const store = require(path.join(root, 'store.js'));
const reminder = require(path.join(root, 'reminderEngine.js'));
const actions = require(path.join(root, 'actions.js'));
const templates = require(path.join(root, 'reminderTemplates.js'));
const mem = new Map();
global.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const reset = () => { require('./fixtures/load-business-data.cjs')(store); store.setDemoDate('2026-10-20'); };
const seller = 'Siti Aishah';
const draftsFor = id => store.getStore().followUpActions.filter(f => f.invoice_id === id && f.checkpoint < 5);

test('tone follows the reminder stage', () => {
  assert.equal(templates.stageTone(1), 'friendly');
  assert.equal(templates.stageTone(2), 'neutral');
  assert.equal(templates.stageTone(3), 'neutral');
  assert.equal(templates.stageTone(4), 'firm');
});

test('new drafts use the customer language and the stage tone', () => {
  reset();
  reminder.runInvoiceCheck();
  const bm = draftsFor('inv-1007')[0]; // Warung Sedap Pak Mat prefers BM, 7 days overdue
  assert.ok(bm, 'draft prepared');
  assert.match(bm.message, /invois INV-1007/);
  assert.match(bm.message, /RM\s?3,600\.00/);
  const en = draftsFor('inv-1003')[0]; // ABC Trading, English, due soon -> friendly
  assert.match(en.message, /^Hi ABC Trading Sdn Bhd!/);
});

test('changing language rewrites only untouched unapproved drafts', () => {
  reset();
  assert.equal(actions.setCustomerLanguage('cust-06', 'zh', seller, 'seller').success, true);
  assert.match(store.getStore().followUpActions.find(f => f.id === 'fu-001').message, /发票 INV-1006/);
  assert.equal(store.getStore().customers.find(c => c.id === 'cust-06').preferred_language, 'zh');

  reset();
  assert.equal(actions.editFollowUpMessage('fu-001', 'Custom words for INV-1006 RM 1,800.00', seller, 'seller').success, true);
  actions.setCustomerLanguage('cust-06', 'en', seller, 'seller');
  assert.equal(store.getStore().followUpActions.find(f => f.id === 'fu-001').message, 'Custom words for INV-1006 RM 1,800.00');
});

test('language changes are validated and business-scoped', () => {
  reset();
  assert.equal(actions.setCustomerLanguage('cust-06', 'fr', seller, 'seller').success, false);
  assert.equal(actions.setCustomerLanguage('cust-delta', 'ms', seller, 'seller').success, false);
  assert.equal(actions.setCustomerLanguage('cust-06', 'zh', 'Rajesh Kumar', 'seller').success, false);
  assert.equal(actions.setCustomerLanguage('cust-06', 'zh', 'Tan Wei Long', 'staff').success, true);
});
