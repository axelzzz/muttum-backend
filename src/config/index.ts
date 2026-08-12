import 'dotenv/config';

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwt: { secret: string; expiresIn: string };
  bcrypt: { saltRounds: number };
  wiktionary: { baseUrl: string };
  cors: { origin: string | string[] };
  frontendUrl: string;
  smtp: { host: string; port: number; secure: boolean; user: string; password: string; from: string };
  passwordReset: { tokenTtlMinutes: number };
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
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? 'Muttum <no-reply@muttum.app>',
  },
  passwordReset: {
    tokenTtlMinutes: Number.parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? '60', 10),
  },
};

if (config.nodeEnv === 'production' && config.jwt.secret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

export default config;
