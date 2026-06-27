const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');
const { sign } = require('../utils/jwt');
const config = require('../config');

function formatUser(row) {
  return {
    id: String(row.id),
    email: row.email,
    username: row.username,
    createdAt: row.created_at,
  };
}

async function register(req, res, next) {
  try {
    const { email, username, password } = req.body;
    const pool = getPool();
    const normalizedEmail = email.toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [normalizedEmail, username, passwordHash]
    );

    const user = result.rows[0];
    const token = sign({ sub: String(user.id), email: user.email });
    return res.status(201).json({ user: formatUser(user), token });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const pool = getPool();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign({ sub: String(user.id), email: user.email });
    return res.json({ user: formatUser(user), token });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(req.userId, 10)]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: formatUser(user) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
