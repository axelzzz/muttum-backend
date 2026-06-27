const createApp = require('./src/app');
const config = require('./src/config');
const { getPool } = require('./src/db/pool');
const fs = require('fs');
const path = require('path');

async function start() {
  const pool = getPool();
  const schema = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
  await pool.query(schema);

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`✓ Server listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
