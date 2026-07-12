import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '../db/pool';
import config from '../config';
import { sendPasswordResetEmail } from './mailService';

const RESET_TOKEN_BYTES = 32;
const MS_PER_MINUTE = 60 * 1000;

interface HttpError extends Error {
  status: number;
}

function httpError(message: string, status: number): HttpError {
  return Object.assign(new Error(message), { status }) as HttpError;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const pool = getPool();
  const normalizedEmail = email.toLowerCase();

  const result = await pool.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];
  if (!user) return;

  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + config.passwordReset.tokenTtlMinutes * MS_PER_MINUTE);

  await pool.query(
    'UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2 WHERE id = $3',
    [hashToken(rawToken), expiresAt, user.id]
  );

  const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(normalizedEmail, resetUrl);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const pool = getPool();

  const result = await pool.query<{ id: number }>(
    'SELECT id FROM users WHERE password_reset_token_hash = $1 AND password_reset_expires_at > now()',
    [hashToken(token)]
  );
  const user = result.rows[0];
  if (!user) {
    throw httpError('Invalid or expired token', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
  await pool.query(
    'UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = $2',
    [passwordHash, user.id]
  );
}
