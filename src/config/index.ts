import 'dotenv/config';

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwt: { secret: string; expiresIn: string };
  bcrypt: { saltRounds: number };
  wiktionary: { baseUrl: string };
  cors: { origin: string | string[] };
}

const config: Config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/dictionary-app',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  bcrypt: {
    saltRounds: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },
  wiktionary: {
    baseUrl: process.env.WIKTIONARY_BASE_URL ?? 'https://fr.wiktionary.org',
  },
  cors: {
    origin: (process.env.CORS_ORIGIN ?? '*').includes(',')
      ? (process.env.CORS_ORIGIN as string).split(',').map((o) => o.trim())
      : (process.env.CORS_ORIGIN ?? '*'),
  },
};

if (config.nodeEnv === 'production' && config.jwt.secret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

export default config;
