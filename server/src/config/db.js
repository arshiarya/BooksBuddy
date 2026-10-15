const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Max clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR] Unexpected client error:', err);
});

/**
 * Execute a parameterized query using the connection pool.
 * @param {string} text - SQL query text with parameter placeholders ($1, $2, ...)
 * @param {Array} [params] - Parameters array
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`[SLOW QUERY ${duration}ms] ${text}`);
    }
    return res;
  } catch (err) {
    console.error(`[QUERY ERROR] ${err.message} | Query: ${text}`);
    throw err;
  }
};

/**
 * Acquire a dedicated client from the pool for manual transaction control.
 * IMPORTANT: Always wrap usage in try...finally and call client.release().
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Perform a database health check probe.
 * @returns {Promise<{ ok: boolean, latencyMs: number, version?: string }>}
 */
const healthCheck = async () => {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT version();');
    return {
      ok: true,
      latencyMs: Date.now() - start,
      version: res.rows[0].version.split(' ')[0] + ' ' + res.rows[0].version.split(' ')[1],
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
};

module.exports = {
  pool,
  query,
  getClient,
  healthCheck,
};
