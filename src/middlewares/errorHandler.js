module.exports = function errorHandler(err, req, res, _next) {
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== 'test') console.error(err);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate key', details: err.detail });
  }
  // Foreign key on user_id → the JWT points to a deleted/nonexistent user
  if (err.code === '23503' && err.detail && err.detail.includes('user_id')) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  // PostgreSQL foreign key / not null / check violation → bad request
  if (['23502', '23503', '23514'].includes(err.code)) {
    return res.status(400).json({ error: 'Validation failed', details: err.detail });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};
