const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const { setPool, closePool } = require('../src/db/pool');

const schemaPath = path.join(__dirname, '../src/db/schema.sql');

beforeAll(async () => {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  const statements = fs
    .readFileSync(schemaPath, 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  setPool(pool);
});

afterAll(async () => {
  await closePool();
});

afterEach(async () => {
  const { getPool } = require('../src/db/pool');
  const pool = getPool();
  await pool.query('DELETE FROM user_words');
  await pool.query('DELETE FROM definitions');
  await pool.query('DELETE FROM words');
  await pool.query('DELETE FROM users');
});
