const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const swaggerSpec = require('./config/swagger');

const BODY_SIZE_LIMIT = '100kb';
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT = 20;
const AUTH_RATE_LIMIT_TEST = 1000;
const authRoutes = require('./routes/authRoutes');
const wordRoutes = require('./routes/wordRoutes');
const errorHandler = require('./middlewares/errorHandler');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: BODY_SIZE_LIMIT }));

  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  if (config.nodeEnv !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
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

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
