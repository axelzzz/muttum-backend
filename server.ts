import createApp from './src/app';
import config from './src/config';
import { getPool } from './src/db/pool';
import { readSchemaFiles } from './src/db/migrationFiles';

async function start(): Promise<void> {
  const pool = getPool();
  for (const sql of readSchemaFiles()) {
    await pool.query(sql);
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
