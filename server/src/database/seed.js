const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

/**
 * Executes development seed SQL files.
 */
async function runSeeds() {
  const client = await pool.connect();
  try {
    const seedsDir = path.join(__dirname, 'seeds');
    if (!fs.existsSync(seedsDir)) {
      console.log('[SEEDS] No seeds directory found.');
      return;
    }

    const seedFiles = fs
      .readdirSync(seedsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`[SEEDS] Executing ${seedFiles.length} seed file(s)...`);

    for (const file of seedFiles) {
      const filePath = path.join(seedsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`[SEEDS] Executing: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`[SEEDS] Successfully executed: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[SEEDS FAILED] Failed while executing ${file}:`, err);
        throw err;
      }
    }

    console.log('[SEEDS COMPLETE] Database successfully seeded with development data.');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SEEDS FATAL ERROR]', err.message);
      process.exit(1);
    });
}

module.exports = { runSeeds };
