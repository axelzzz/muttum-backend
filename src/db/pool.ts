import { Pool } from 'pg';
import config from '../config';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: config.databaseUrl });
  }
  return _pool;
}

export function setPool(pool: Pool): void {
  _pool = pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
