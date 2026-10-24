const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeSchema } = require('../server/init-schema.cjs');

test('imports the trusted schema only into an empty database', async () => {
  const calls = [];
  const connection = { query: async sql => { calls.push(sql); return [[]]; } };
  assert.equal(await initializeSchema(connection, 'CREATE TABLE example (id INT)'), true);
  assert.deepEqual(calls, ['SHOW TABLES', 'CREATE TABLE example (id INT)']);
});

test('leaves a current database untouched', async () => {
  const calls = [];
  const connection = { query: async sql => { calls.push(sql); return [[{ Tables_in_nudgewise_db: 'businesses' }]]; } };
  assert.equal(await initializeSchema(connection, 'unused schema'), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], 'SHOW TABLES');
  assert.ok(calls[1].startsWith('SELECT DATA_TYPE FROM information_schema.COLUMNS'));
});

test('widens the legacy delivery status column once without recreating existing tables', async () => {
  let type = 'varchar';
  const writes = [];
  const connection = { query: async sql => {
    if (sql === 'SHOW TABLES') return [[{ table: 'follow_up_actions' }]];
    if (sql.startsWith('SELECT DATA_TYPE')) return [[{ DATA_TYPE: type }]];
    writes.push(sql);
    type = 'text';
    return [[]];
  } };
  assert.equal(await initializeSchema(connection, 'must not import over existing data'), false);
  assert.equal(await initializeSchema(connection, 'must not import over existing data'), false);
  assert.deepEqual(writes, ['ALTER TABLE follow_up_actions MODIFY COLUMN delivery_status TEXT NULL']);
});

test('reports a migration failure rather than ignoring it', async () => {
  const failure = new Error('Database migration denied');
  const connection = { query: async sql => {
    if (sql === 'SHOW TABLES') return [[{ table: 'follow_up_actions' }]];
    if (sql.startsWith('SELECT DATA_TYPE')) return [[{ DATA_TYPE: 'varchar' }]];
    throw failure;
  } };
  await assert.rejects(initializeSchema(connection, 'unused'), failure);
});

test('propagates an import failure instead of claiming initialization succeeded', async () => {
  const failure = new Error('Invalid schema');
  const connection = { query: async sql => { if (sql === 'SHOW TABLES') return [[]]; throw failure; } };
  await assert.rejects(initializeSchema(connection, 'invalid'), failure);
});
