const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBackend } = require('../server/app.cjs');
const store = require('../.server-build/lib/store.js');
const actions = require('../.server-build/lib/actions.js');
const { validateExtraction } = require('../.server-build/lib/receipts.js');
const { fileExtension } = require('../server/integrations.cjs');
const { Readable } = require('node:stream');

function request(backend, method, url, body, headers = {}) {
  return new Promise(resolve => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    Object.assign(req, { method, url, headers: { host: '127.0.0.1:8787', 'content-type': 'application/json', 'x-nudgewise-local': '1', ...headers } });
    let status;
    const res = { writeHead: code => { status = code; }, end: value => resolve({ status, body: JSON.parse(value) }) };
    backend.server.emit('request', req, res);
  });
}

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nudgewise-test-'));
  const api = options;
  const backend = createBackend({ directory, api });
  require('./fixtures/load-business-data.cjs')(require('../.server-build/lib/store.js'));
  t.after(() => {
    backend.stop(); backend.db.close();
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('nudgewise-test-'));
    fs.rmSync(directory, { recursive: true });
  });
  return backend;
}

test('transaction rollback restores both cached state and SQLite', t => {
  const backend = fixture(t); const before = structuredClone(backend.snapshot());
  assert.throws(() => backend.transaction(() => { store.addPayment('inv-1006', 100, '2026-10-20', 'bank_transfer', 'rollback'); throw new Error('rollback'); }));
  assert.deepEqual(backend.snapshot(), before);
  assert.equal(JSON.parse(backend.db.prepare('SELECT value FROM state WHERE id = ?').get('nudgewise-demo-v1.1').value).payments.length, before.payments.length);
});

test('file signatures and extracted schema fail closed', () => {
  assert.equal(fileExtension(Buffer.from('%PDF-1.7')), 'pdf');
  assert.equal(fileExtension(Buffer.from([255,216,255,0])), 'jpg');
  assert.equal(fileExtension(Buffer.from([137,80,78,71,13,10,26,10])), 'png');
  assert.throws(() => fileExtension(Buffer.from('<script>')));
  assert.throws(() => validateExtraction('fake JSON'));
  assert.throws(() => validateExtraction({ amount: '1800' }));
});

test('API rejects foreign origins, DNS rebinding hosts, missing local header and unknown commands', async t => {
  const backend = fixture(t);
  assert.equal((await request(backend, 'GET', '/api/state', undefined, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await request(backend, 'GET', '/api/state', undefined, { host: 'evil.example' })).status, 403);
  assert.equal((await request(backend, 'POST', '/api/command', { name: 'resetStore', args: [] }, { 'x-nudgewise-local': '' })).status, 403);
  assert.equal((await request(backend, 'POST', '/api/command', { name: '__proto__', args: [] })).status, 400);
  assert.equal((await request(backend, 'GET', '/api/state')).body.integration.model, 'gemma4:31b');
});


test('removed messaging commands are unavailable even when an old token is configured', async t => {
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'unused-old-token';
  t.after(() => { if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = previous; });
  const backend = fixture(t);
  assert.equal(backend.poll, undefined);
  assert.equal(backend.receive, undefined);
  assert.equal(require('../server/integrations.cjs').telegram, undefined);
  assert.equal(require('../server/integrations.cjs').download, undefined);
  for (const name of ['linkTelegram', 'resolveReceipt'])
    assert.equal((await request(backend, 'POST', '/api/command', { name, args: ['cust-06', '123456'] })).status, 400);
  const state = await request(backend, 'GET', '/api/state');
  assert.equal('botConfigured' in state.body.integration, false);
});

test('backend reminder delivery stays a simulation and requires seller approval', async t => {
  const backend = fixture(t);
  assert.equal((await request(backend, 'POST', '/api/command', { name: 'sendApprovedFollowUp', args: ['fu-001', 'Siti Aishah'] })).body.result.success, false);
  assert.equal(actions.approveFollowUp('fu-001', 'user-seller', 'Siti Aishah', 'seller').success, true);
  const result = await request(backend, 'POST', '/api/command', { name: 'sendApprovedFollowUp', args: ['fu-001', 'Siti Aishah'] });
  assert.equal(result.body.result.success, true);
  assert.equal(result.body.result.simulated, true);
});
