import request from 'supertest';
import createApp from '../../src/app';
import { createUser } from '../fixtures/users';
import { sign } from '../../src/utils/jwt';

const app = createApp();

describe('POST /api/auth/register', () => {
  it('creates a new user and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', username: 'New', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.username).toBe('New');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invalid', username: 'X', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', username: 'X', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    await createUser({ email: 'dup@x.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@x.com', username: 'Other', password: 'secret123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a JWT with valid credentials', async () => {
    await createUser({ email: 'login@x.com', password: 'mypass123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@x.com', password: 'mypass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('login@x.com');
  });

  it('returns 401 with wrong password', async () => {
    await createUser({ email: 'login@x.com', password: 'mypass123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@x.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noone@x.com', password: 'whatever123' });
    expect(res.status).toBe(401);
  });

  it('login is case-insensitive on email', async () => {
    await createUser({ email: 'mix@x.com', password: 'mypass123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'MIX@X.COM', password: 'mypass123' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user profile with valid token', async () => {
    const user = await createUser({ email: 'me@x.com', username: 'Me' });
    const token = sign({ sub: String(user.id), email: user.email });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@x.com');
    expect(res.body.user.username).toBe('Me');
  });
});
