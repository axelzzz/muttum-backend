import createApp from './src/app';
import config from './src/config';
import { getPool } from './src/db/pool';
import fs from 'fs';
import path from 'path';

async function start(): Promise<void> {
  const pool = getPool();
  const schema = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
  await pool.query(schema);

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
