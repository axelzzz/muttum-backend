import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import config from './config';
import swaggerSpec from './config/swagger';
import authRoutes from './routes/authRoutes';
import wordRoutes from './routes/wordRoutes';
import errorHandler from './middlewares/errorHandler';

const BODY_SIZE_LIMIT = '100kb';
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT = 20;
const AUTH_RATE_LIMIT_TEST = 1000;

export default function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: BODY_SIZE_LIMIT }));

  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (config.nodeEnv !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
  }

  // Mitigate brute force on auth endpoints
  const authLimiter = rateLimit({
    windowMs: AUTH_RATE_WINDOW_MS,
    max: config.nodeEnv === 'test' ? AUTH_RATE_LIMIT_TEST : AUTH_RATE_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/words', wordRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);

  return app;
}
