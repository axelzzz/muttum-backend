import * as mailService from '../../src/services/mailService';

jest.mock('../../src/services/mailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as passwordResetService from '../../src/services/passwordResetService';
import { getPool } from '../../src/db/pool';
import { createUser } from '../fixtures/users';

const mockedSendPasswordResetEmail = jest.mocked(mailService.sendPasswordResetEmail);

afterEach(() => {
  mockedSendPasswordResetEmail.mockClear();
});

async function requestAndExtractToken(email: string): Promise<string> {
  await passwordResetService.requestPasswordReset(email);
  const calls = mockedSendPasswordResetEmail.mock.calls;
  const lastCall = calls[calls.length - 1];
  const resetUrl = lastCall?.[1];
  const token = resetUrl ? new URL(resetUrl).searchParams.get('token') : null;
  if (!token) throw new Error('token missing from reset url');
  return token;
}

describe('requestPasswordReset', () => {
  it('stores a hashed token and sends an email when the user exists', async () => {
    const user = await createUser({ email: 'reset@x.com' });
    await passwordResetService.requestPasswordReset('reset@x.com');

    const pool = getPool();
    const res = await pool.query<{ password_reset_token_hash: string | null; password_reset_expires_at: Date | null }>(
      'SELECT password_reset_token_hash, password_reset_expires_at FROM users WHERE id = $1',
      [user.id]
    );
    expect(res.rows[0].password_reset_token_hash).not.toBeNull();
    expect(res.rows[0].password_reset_expires_at).not.toBeNull();
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledWith(
      'reset@x.com',
      expect.stringContaining('/auth/reset-password?token=')
    );
  });

  it('does nothing when the email is not registered', async () => {
    await passwordResetService.requestPasswordReset('unknown@x.com');
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('is case-insensitive on email', async () => {
    await createUser({ email: 'case@x.com' });
    await passwordResetService.requestPasswordReset('CASE@X.COM');
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledWith('case@x.com', expect.any(String));
  });
});

describe('resetPassword', () => {
  it('updates the password hash and clears the token on a valid token', async () => {
    const user = await createUser({ email: 'valid@x.com', password: 'oldpass123' });
    const token = await requestAndExtractToken('valid@x.com');

    await passwordResetService.resetPassword(token, 'newpass456');

    const pool = getPool();
    const res = await pool.query<{ password_hash: string; password_reset_token_hash: string | null }>(
      'SELECT password_hash, password_reset_token_hash FROM users WHERE id = $1',
      [user.id]
    );
    expect(await bcrypt.compare('newpass456', res.rows[0].password_hash)).toBe(true);
    expect(res.rows[0].password_reset_token_hash).toBeNull();
  });

  it('rejects an unknown token', async () => {
    await expect(passwordResetService.resetPassword('not-a-real-token', 'newpass456')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects an expired token', async () => {
    const user = await createUser({ email: 'expired@x.com' });
    const pool = getPool();
    const rawToken = 'expired-token-value';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      'UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2 WHERE id = $3',
      [tokenHash, new Date(Date.now() - 1000), user.id]
    );

    await expect(passwordResetService.resetPassword(rawToken, 'newpass456')).rejects.toMatchObject({ status: 400 });
  });

  it('invalidates the token after a successful reset', async () => {
    await createUser({ email: 'once@x.com' });
    const token = await requestAndExtractToken('once@x.com');

    await passwordResetService.resetPassword(token, 'newpass456');

    await expect(passwordResetService.resetPassword(token, 'anotherpass789')).rejects.toMatchObject({ status: 400 });
  });
});
