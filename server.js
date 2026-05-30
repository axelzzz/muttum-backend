const createApp = require('./src/app');
const config = require('./src/config');
const { connectDB } = require('./src/config/db');

async function start() {
  await connectDB();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`✓ Server listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
