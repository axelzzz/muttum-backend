const { sign, verify } = require('../../src/utils/jwt');
const authMiddleware = require('../../src/middlewares/auth');

describe('jwt utility', () => {
  it('signs and verifies a payload', () => {
    const token = sign({ sub: 'user-id', email: 'a@b.com' });
    expect(typeof token).toBe('string');
    const decoded = verify(token);
    expect(decoded.sub).toBe('user-id');
    expect(decoded.email).toBe('a@b.com');
  });

  it('rejects an invalid token', () => {
    expect(() => verify('not-a-token')).toThrow();
  });
});

describe('auth middleware', () => {
  function buildRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
  }

  it('returns 401 when no Authorization header', () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with malformed header', () => {
    const req = { headers: { authorization: 'NotBearer xyz' } };
    const res = buildRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with invalid token', () => {
    const req = { headers: { authorization: 'Bearer not.a.jwt' } };
    const res = buildRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches userId and calls next on valid token', () => {
    const token = sign({ sub: 'abc-123', email: 'a@b.com' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = buildRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(req.userId).toBe('abc-123');
    expect(req.user).toEqual({ id: 'abc-123', email: 'a@b.com' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
