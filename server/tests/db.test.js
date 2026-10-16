const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { runMigrations } = require('../src/database/migrate');

describe('Database Engine & Schema Verification (Phase 2)', () => {

  test('Database connection pool is healthy and returns PostgreSQL version', async () => {
    const health = await db.healthCheck();
    assert.equal(health.ok, true);
    assert.ok(health.latencyMs >= 0);
    assert.ok(health.version.toLowerCase().includes('postgresql'));
  });

  test('Migration runner is idempotent', async () => {
    // Running migrations when already applied must return 0 totalPending
    const result = await runMigrations();
    assert.equal(result.totalPending, 0);
    assert.equal(result.applied.length, 0);
  });

  test('All 13 approved domain tables exist in information_schema', async () => {
    const expectedTables = [
      'users',
      'sessions',
      'libraries',
      'library_members',
      'books',
      'borrow_requests',
      'handover_sessions',
      'custody_history',
      'chat_messages',
      'book_demands',
      'book_demand_votes',
      'contributions_ledger',
      'community_notices',
    ];

    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    const existingTables = new Set(res.rows.map((r) => r.table_name));

    for (const table of expectedTables) {
      assert.ok(
        existingTables.has(table),
        `Table "${table}" must exist in public schema`
      );
    }
  });

  test('Approved partial unique indexes exist in PostgreSQL catalog', async () => {
    const expectedIndexes = [
      'uq_single_active_or_pending_borrow',
      'uq_user_active_or_queued_request',
      'uq_single_pending_handover_session',
      'uq_library_user',
    ];

    const res = await db.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public';
    `);

    const existingIndexes = new Set(res.rows.map((r) => r.indexname));

    for (const index of expectedIndexes) {
      assert.ok(
        existingIndexes.has(index),
        `Index/Constraint "${index}" must exist in pg_indexes`
      );
    }
  });

  test('Database transactions cleanly roll back on failure', async () => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const testEmail = `rollback_test_${Date.now()}@example.com`;
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, society_locality, flat_house_number, city)
         VALUES ($1, 'dummy_hash', 'Rollback User', '+910000000000', 'Locality', '101', 'City');`,
        [testEmail]
      );

      // Verify row exists inside the active transaction
      const inTxCheck = await client.query('SELECT id FROM users WHERE email = $1;', [testEmail]);
      assert.equal(inTxCheck.rowCount, 1);

      // Force explicit rollback
      await client.query('ROLLBACK');

      // Verify row does NOT exist after rollback
      const postRollbackCheck = await db.query('SELECT id FROM users WHERE email = $1;', [testEmail]);
      assert.equal(postRollbackCheck.rowCount, 0);
    } finally {
      client.release();
    }
  });

  test('Initial book donations have atomic custody_history audit records', async () => {
    const res = await db.query(`
      SELECT b.id AS book_id, b.original_donor_id, b.current_custodian_id, ch.from_user_id, ch.to_user_id
      FROM books b
      LEFT JOIN custody_history ch ON ch.book_id = b.id AND ch.from_user_id IS NULL
    `);

    assert.ok(res.rowCount > 0, 'Seeded books must exist');
    for (const row of res.rows) {
      assert.equal(row.from_user_id, null, 'Initial donation must have from_user_id = NULL');
      assert.equal(
        row.to_user_id,
        row.original_donor_id,
        'Initial custody history must attribute custody to donor'
      );
      assert.equal(
        row.current_custodian_id,
        row.original_donor_id,
        'Initial book record must set custodian to donor'
      );
    }
  });
});
