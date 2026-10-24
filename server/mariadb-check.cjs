// Read-only connection check for the user's XAMPP MariaDB service.
(async()=>{
  if (!process.env.DB_USER) throw Error('DB_USER missing from .env');
  const mysql=require('mysql2/promise');
  const conn=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'nudgewise_db'});
  try {
    const [[server]]=await conn.query('SELECT DATABASE() AS database_name, VERSION() AS maria_version');
    const [[{tables}]]=await conn.execute(`SELECT COUNT(*) AS tables FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'`,[process.env.DB_NAME||'nudgewise_db']);
    const [[{customers}]]=await conn.query('SELECT COUNT(*) AS customers FROM customers');
    console.log('MariaDB connection: OK');
    console.log(`Database: ${server.database_name}`);
    console.log(`Server version: ${server.maria_version}`);
    console.log(`Tables: ${tables} (29 before NudgeWise creates its two runtime tables)`);
    console.log(`Customer rows: ${customers}`);
  } finally {await conn.end();}
})().catch(error=>{console.error('MariaDB check failed:',error.message);process.exitCode=1;});
