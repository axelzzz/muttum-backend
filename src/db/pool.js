const { Pool } = require('pg');
const config = require('../config');

let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: config.databaseUrl });
  }
  return _pool;
}

function setPool(pool) {
  _pool = pool;
}

async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { getPool, setPool, closePool };
