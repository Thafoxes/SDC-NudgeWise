const fs = require('node:fs');
const path = require('node:path');

async function initializeSchema(connection, schema) {
  const [tables] = await connection.query('SHOW TABLES');
  if (tables.length) return false;
  await connection.query(schema);
  return true;
}

if (require.main === module) {
  (async () => {
    if (process.env.DB_CLIENT !== 'mariadb') return;
    const connection = await require('mysql2/promise').createConnection({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME, multipleStatements: true,
    });
    try {
      if (await initializeSchema(connection, fs.readFileSync(path.join(__dirname, '../database/MARIADB_SCHEMA_REFERENCE_ONLY_NOT_CONNECTED.sql'), 'utf8')))
        console.log('Initialized empty MariaDB schema');
    } finally { await connection.end(); }
  })().catch(error => { console.error('Schema initialization failed:', error.message); process.exitCode = 1; });
}

module.exports = { initializeSchema };
