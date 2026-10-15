const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

/**
 * Executes all pending SQL migration files in transactional order.
 * @returns {Promise<{ applied: string[], totalPending: number }>}
 */
async function runMigrations() {
  const client = await pool.connect();
  const applied = [];

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 2. Fetch applied migration names
    const { rows: appliedRows } = await client.query(
      'SELECT name FROM schema_migrations ORDER BY id ASC;'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 3. Scan migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[MIGRATIONS] No migrations directory found.');
      return { applied: [], totalPending: 0 };
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const pending = migrationFiles.filter((file) => !appliedSet.has(file));

    if (pending.length === 0) {
      console.log('[MIGRATIONS] Database schema is up to date. No pending migrations.');
      return { applied: [], totalPending: 0 };
    }

    console.log(`[MIGRATIONS] Found ${pending.length} pending migration(s)...`);

    // 4. Apply each pending migration inside an isolated transaction
    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`[MIGRATIONS] Applying: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
        await client.query('COMMIT');
        applied.push(file);
        console.log(`[MIGRATIONS] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATIONS FAILED] Failed while applying ${file}:`, err);
        throw err;
      }
    }

    console.log(`[MIGRATIONS COMPLETE] Applied ${applied.length} migration(s).`);
    return { applied, totalPending: pending.length };
  } finally {
    client.release();
  }
}

// Allow direct CLI execution
if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATIONS FATAL ERROR]', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };
