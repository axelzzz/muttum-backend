const bcrypt = require('bcryptjs');
const { getPool } = require('../../src/db/pool');
const config = require('../../src/config');
const { sign } = require('../../src/utils/jwt');

async function createUser(overrides = {}) {
  const data = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    ...overrides,
  };
  const pool = getPool();
  const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);
  const res = await pool.query(
    'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [data.email.toLowerCase(), data.username, passwordHash]
  );
  return res.rows[0];
}

function buildToken(user) {
  return sign({ sub: String(user.id), email: user.email });
}

async function createUserAndToken(overrides = {}) {
  const user = await createUser(overrides);
  const token = buildToken(user);
  return { user, token };
}

module.exports = { createUser, buildToken, createUserAndToken };
