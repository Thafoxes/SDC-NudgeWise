const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeSchema } = require('../server/init-schema.cjs');

test('imports the trusted schema only into an empty database', async () => {
  const calls = [];
  const connection = { query: async sql => { calls.push(sql); return [[]]; } };
  assert.equal(await initializeSchema(connection, 'CREATE TABLE example (id INT)'), true);
  assert.deepEqual(calls, ['SHOW TABLES', 'CREATE TABLE example (id INT)']);
});

test('leaves existing database tables untouched', async () => {
  const calls = [];
  const connection = { query: async sql => { calls.push(sql); return [[{ Tables_in_nudgewise_db: 'businesses' }]]; } };
  assert.equal(await initializeSchema(connection, 'unused schema'), false);
  assert.deepEqual(calls, ['SHOW TABLES']);
});

test('propagates an import failure instead of claiming initialization succeeded', async () => {
  const failure = new Error('Invalid schema');
  const connection = { query: async sql => { if (sql === 'SHOW TABLES') return [[]]; throw failure; } };
  await assert.rejects(initializeSchema(connection, 'invalid'), failure);
});
