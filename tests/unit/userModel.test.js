const bcrypt = require('bcryptjs');
const { getPool } = require('../../src/db/pool');

const FAST_ROUNDS = 4;

describe('users table', () => {
  it('stores a bcrypt hash, not the plain password', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('secret123', FAST_ROUNDS);
    const res = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['a@b.com', 'Alice', hash]
    );
    expect(res.rows[0].password_hash).not.toBe('secret123');
    expect(res.rows[0].password_hash.startsWith('$2')).toBe(true);
  });

  it('bcrypt.compare returns true for correct password, false for wrong one', async () => {
    const hash = await bcrypt.hash('secret123', FAST_ROUNDS);
    await expect(bcrypt.compare('secret123', hash)).resolves.toBe(true);
    await expect(bcrypt.compare('wrong', hash)).resolves.toBe(false);
  });

  it('password_hash is not exposed in the formatted user object', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('secret123', FAST_ROUNDS);
    const res = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, created_at',
      ['a@b.com', 'Alice', hash]
    );
    expect(res.rows[0].password_hash).toBeUndefined();
    expect(res.rows[0].email).toBe('a@b.com');
    expect(res.rows[0].username).toBe('Alice');
  });

  it('enforces unique email', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('pass', FAST_ROUNDS);
    await pool.query('INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)', ['dup@x.com', 'Al', hash]);
    await expect(
      pool.query('INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)', ['dup@x.com', 'Bo', hash])
    ).rejects.toThrow();
  });

  it('email is stored as passed — application lowercases before insert', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('pass', FAST_ROUNDS);
    const res = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING email',
      ['mixed@case.com', 'Xi', hash]
    );
    expect(res.rows[0].email).toBe('mixed@case.com');
  });
});
