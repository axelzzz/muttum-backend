import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { setPool, closePool, getPool } from '../src/db/pool';
import { readSchemaFiles } from '../src/db/migrationFiles';

beforeAll(async () => {
  const db = newDb();
  const { Pool: PgMemPool } = db.adapters.createPg();
  const pool = new PgMemPool();

  for (const sql of readSchemaFiles()) {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await pool.query(stmt);
    }
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
