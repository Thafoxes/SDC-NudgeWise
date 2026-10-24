/** Server endpoint for the tone & language studio. Run with: npm run test:server */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createBackend } = require('../server/app.cjs');

function request(backend, body) {
  return new Promise(resolve => {
    const req = Readable.from([JSON.stringify(body)]);
    Object.assign(req, { method: 'POST', url: '/api/command', headers: { host: '127.0.0.1:8787', 'content-type': 'application/json', 'x-nudgewise-local': '1' } });
    let status;
    const res = { writeHead: code => { status = code; }, end: value => resolve({ status, body: JSON.parse(value) }) };
    backend.server.emit('request', req, res);
  });
}

function fixture(t, chat) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgewise-test-'));
  const prompts = [];
  const api = { chat: async messages => { prompts.push(messages); return chat(messages); } };
  const backend = createBackend({ directory, api });
  require('./fixtures/load-business-data.cjs')(require('../.server-build/lib/store.js'));
  t.after(() => { backend.stop(); backend.db.close(); fs.rmSync(directory, { recursive: true }); });
  return { backend, prompts };
}

test('rewriteReminder sends record facts to Gemma and returns its text', async t => {
  const { backend, prompts } = fixture(t, async () => 'Salam Chong Kah Mun, invois INV-1006 berjumlah RM 1800.00 masih belum dijelaskan. — Kedai Maju Jaya');
  const r = await request(backend, { name: 'rewriteReminder', args: ['fu-001', 'friendly', 'ms'] });
  assert.equal(r.status, 200);
  assert.match(r.body.result.text, /INV-1006/);
  const facts = JSON.parse(prompts[0][1].content);
  assert.equal(facts.invoice_number, 'INV-1006');
  assert.equal(facts.amount, 'RM 1800.00');
  assert.match(prompts[0][0].content, /Bahasa Melayu/);
});

test('rewriteReminder rejects bad input and drafts without the invoice number', async t => {
  const { backend } = fixture(t, async () => 'Please pay soon.');
  assert.equal((await request(backend, { name: 'rewriteReminder', args: ['fu-001', 'angry', 'en'] })).status, 400);
  assert.equal((await request(backend, { name: 'rewriteReminder', args: ['fu-001', 'firm', 'xx'] })).status, 400);
  assert.equal((await request(backend, { name: 'rewriteReminder', args: ['missing', 'firm', 'en'] })).status, 404);
  assert.equal((await request(backend, { name: 'rewriteReminder', args: ['fu-001', 'firm', 'en'] })).status, 502);
});

test('rewriteReminder never changes the reminder by itself', async t => {
  const { backend } = fixture(t, async () => 'Hi, INV-1006 for RM 1800.00 is overdue. — Kedai Maju Jaya');
  const before = backend.snapshot().followUpActions.find(f => f.id === 'fu-001');
  await request(backend, { name: 'rewriteReminder', args: ['fu-001', 'neutral', 'en'] });
  const after = backend.snapshot().followUpActions.find(f => f.id === 'fu-001');
  assert.equal(after.message, before.message);
  assert.equal(after.approval_state, before.approval_state);
});
