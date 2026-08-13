import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../db/pool';
import { sign } from '../utils/jwt';
import config from '../config';
import type { UserDto } from '../types';

interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

function formatUser(row: UserRow): UserDto {
  return {
    id: String(row.id),
    email: row.email,
    username: row.username,
    createdAt: row.created_at,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, username, password } = req.body as { email: string; username: string; password: string };
    const pool = getPool();
    const normalizedEmail = email.toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const result = await pool.query<UserRow>(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [normalizedEmail, username, passwordHash]
    );

    const user = result.rows[0];
    const token = sign({ sub: String(user.id), email: user.email });
    res.status(201).json({ user: formatUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const pool = getPool();

    const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = sign({ sub: String(user.id), email: user.email });
    res.json({ user: formatUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [parseInt(req.userId, 10)]);
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: formatUser(user) });
  } catch (err) {
    next(err);
  }
}
