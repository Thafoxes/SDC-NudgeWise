const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAccessGuard } = require('../server/access.cjs');

function guard(t, values) {
  const names = ['PORT', 'PUBLIC_DEMO', 'DEMO_ACCESS_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
  t.after(() => { for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  } });
  return createAccessGuard();
}

test('public demo explicitly allows access and tells the UI no passcode is needed', async t => {
  const check = guard(t, { PORT: '8080', PUBLIC_DEMO: 'true', DEMO_ACCESS_KEY: 'unused-test-key' });
  const req = { method: 'GET', url: '/api/state', headers: {} };
  assert.equal(await check(req, {}, () => assert.fail('Unexpected rejection')), true);
  let result;
  await check({ ...req, url: '/api/access' }, {}, (status, body) => { result = { status, body }; });
  assert.deepEqual(result, { status: 200, body: { required: false, authenticated: true } });
});

test('a public server without a key still fails closed unless public mode is explicit', async t => {
  const check = guard(t, { PORT: '8080', PUBLIC_DEMO: 'false' });
  let status;
  assert.equal(await check({ url: '/api/state', headers: {} }, {}, code => { status = code; }), false);
  assert.equal(status, 503);
});

test('protected deployments still require their passcode', async t => {
  const check = guard(t, { PORT: '8080', DEMO_ACCESS_KEY: 'synthetic-key' });
  let status;
  const req = { url: '/api/state', headers: {} };
  assert.equal(await check(req, {}, code => { status = code; }), false);
  assert.equal(status, 401);
  assert.equal(await check({ ...req, headers: { 'x-demo-key': 'synthetic-key' } }, {}, () => assert.fail()), true);
});
