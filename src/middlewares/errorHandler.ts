import type { Request, Response, NextFunction } from 'express';

interface PgError {
  code?: string;
  detail?: string;
}

export default function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (process.env.NODE_ENV !== 'test') console.error(err);

  const pgErr = err as PgError;
  const httpErr = err as { status?: number; statusCode?: number; message?: string };
  const message = err instanceof Error ? err.message : 'Internal server error';

  // PostgreSQL unique violation
  if (pgErr.code === '23505') {
    res.status(409).json({ error: 'Duplicate key', details: pgErr.detail });
    return;
  }
  // Foreign key on user_id → the JWT points to a deleted/nonexistent user
  if (pgErr.code === '23503' && pgErr.detail?.includes('user_id')) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  // PostgreSQL foreign key / not null / check violation → bad request
  if (['23502', '23503', '23514'].includes(pgErr.code ?? '')) {
    res.status(400).json({ error: 'Validation failed', details: pgErr.detail });
    return;
  }

  const status = httpErr.status ?? httpErr.statusCode ?? 500;
  res.status(status).json({ error: message });
}
