require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dictionary-app',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },
  wiktionary: {
    baseUrl: process.env.WIKTIONARY_BASE_URL || 'https://fr.wiktionary.org/api/rest_v1/page/definition',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

if (config.nodeEnv === 'production' && config.jwt.secret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
