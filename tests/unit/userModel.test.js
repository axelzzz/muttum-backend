const User = require('../../src/models/User');

describe('User model', () => {
  it('hashes the password on save', async () => {
    const user = new User({ email: 'a@b.com', username: 'Alice' });
    user.password = 'secret123';
    await user.save();
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('secret123');
    expect(user.passwordHash.startsWith('$2')).toBe(true);
  });

  it('compares password correctly', async () => {
    const user = new User({ email: 'a@b.com', username: 'Alice' });
    user.password = 'secret123';
    await user.save();
    await expect(user.comparePassword('secret123')).resolves.toBe(true);
    await expect(user.comparePassword('wrong')).resolves.toBe(false);
  });

  it('does not expose passwordHash in toJSON', async () => {
    const user = new User({ email: 'a@b.com', username: 'Alice' });
    user.password = 'secret123';
    await user.save();
    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.email).toBe('a@b.com');
    expect(json.username).toBe('Alice');
  });

  it('rejects invalid email format', async () => {
    const user = new User({ email: 'not-an-email', username: 'X' });
    user.password = 'pass1234';
    await expect(user.save()).rejects.toThrow();
  });

  it('enforces unique email', async () => {
    const u1 = new User({ email: 'dup@x.com', username: 'A' });
    u1.password = 'pass1234';
    await u1.save();

    const u2 = new User({ email: 'dup@x.com', username: 'B' });
    u2.password = 'pass1234';
    await expect(u2.save()).rejects.toThrow();
  });

  it('lowercases the email', async () => {
    const user = new User({ email: 'MIXED@Case.COM', username: 'X' });
    user.password = 'pass1234';
    await user.save();
    expect(user.email).toBe('mixed@case.com');
  });
});
