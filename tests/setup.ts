import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import { setPool, closePool, getPool } from '../src/db/pool';

const schemaPath = path.join(__dirname, '../src/db/schema.sql');

beforeAll(async () => {
  const db = newDb();
  const { Pool: PgMemPool } = db.adapters.createPg();
  const pool = new PgMemPool();

  const statements = fs
    .readFileSync(schemaPath, 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  setPool(pool as unknown as Pool);
});

afterAll(async () => {
  await closePool();
});

afterEach(async () => {
  const pool = getPool();
  await pool.query('DELETE FROM user_words');
  await pool.query('DELETE FROM definitions');
  await pool.query('DELETE FROM words');
  await pool.query('DELETE FROM users');
});
