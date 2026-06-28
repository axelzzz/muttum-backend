import bcrypt from 'bcryptjs';
import { getPool } from '../../src/db/pool';
import config from '../../src/config';
import { sign } from '../../src/utils/jwt';

interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

interface UserOverrides {
  email?: string;
  username?: string;
  password?: string;
}

export async function createUser(overrides: UserOverrides = {}): Promise<UserRow> {
  const data = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    ...overrides,
  };
  const pool = getPool();
  const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);
  const res = await pool.query<UserRow>(
    'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [data.email.toLowerCase(), data.username, passwordHash]
  );
  return res.rows[0];
}

export function buildToken(user: Pick<UserRow, 'id' | 'email'>): string {
  return sign({ sub: String(user.id), email: user.email });
}

export async function createUserAndToken(
  overrides: UserOverrides = {}
): Promise<{ user: UserRow; token: string }> {
  const user = await createUser(overrides);
  const token = buildToken(user);
  return { user, token };
}
