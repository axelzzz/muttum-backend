import { newDb, DataType } from 'pg-mem';
import type { Pool } from 'pg';
import { setPool, closePool, getPool } from '../src/db/pool';
import { readSchemaFiles } from '../src/db/migrationFiles';

const UNICODE_CANONICAL_DECOMPOSITION = 'NFD';

function stripAccentsForTest(value: string): string {
  return value.normalize(UNICODE_CANONICAL_DECOMPOSITION).replace(/\p{Diacritic}/gu, '');
}

beforeAll(async () => {
  const db = newDb();

  // pg-mem has no built-in `unaccent` extension; shim it so schema/migrations
  // that rely on it behave the same as against real PostgreSQL.
  db.public.registerFunction({
    name: 'unaccent',
    args: [DataType.text],
    returns: DataType.text,
    implementation: stripAccentsForTest,
  });

  const { Pool: PgMemPool } = db.adapters.createPg();
  const pool = new PgMemPool();

  for (const sql of readSchemaFiles()) {
    // pg-mem has no plpgsql support, and naively splitting on ';' would also
    // mangle a DO block's internal statements — strip DO blocks wholesale,
    // same treatment as CREATE EXTENSION below.
    const withoutDoBlocks = sql.replace(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi, '');
    const statements = withoutDoBlocks
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^CREATE EXTENSION/i.test(s))
      // A fragment can be comment-only (e.g. leftovers next to a stripped DO
      // block) — that has no SQL command for pg-mem to execute.
      .filter((s) => s.replace(/--.*$/gm, '').trim().length > 0);

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
