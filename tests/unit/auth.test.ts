import type { Request, Response, NextFunction } from 'express';
import { sign, verify } from '../../src/utils/jwt';
import authMiddleware from '../../src/middlewares/auth';

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
  function buildRes(): Response {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) { res.statusCode = code; return res; },
      json(payload: unknown) { res.body = payload; return res; },
    };
    return res as unknown as Response;
  }

  it('returns 401 when no Authorization header', () => {
    const req = { headers: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with malformed header', () => {
    const req = { headers: { authorization: 'NotBearer xyz' } } as unknown as Request;
    const res = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with invalid token', () => {
    const req = { headers: { authorization: 'Bearer not.a.jwt' } } as unknown as Request;
    const res = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches userId and calls next on valid token', () => {
    const token = sign({ sub: 'abc-123', email: 'a@b.com' });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = buildRes();
    const next = jest.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect(req.userId).toBe('abc-123');
    expect(req.user).toEqual({ id: 'abc-123', email: 'a@b.com' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
