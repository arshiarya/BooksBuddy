const db = require('../../config/db');

/**
 * Platform Admin Service
 * Provides global administrative controls over all BooksBuddy libraries.
 */

/**
 * Lists all libraries across the platform with creator info and stats.
 */
async function listAllLibraries() {
  const query = `
    SELECT 
      l.id,
      l.name,
      l.slug,
      l.society_locality,
      l.city,
      l.description,
      l.invite_code,
      l.is_verified,
      l.status,
      l.created_at,
      l.created_by,
      u.full_name AS creator_name,
      u.email AS creator_email,
      COUNT(DISTINCT lm.user_id) AS total_members,
      COUNT(DISTINCT b.id) AS total_books,
      COUNT(DISTINCT br.id) FILTER (WHERE br.status IN ('ACTIVE', 'HANDOVER_PENDING', 'CUSTODIAN_APPROVAL_PENDING')) AS active_requests
    FROM libraries l
    LEFT JOIN users u ON u.id = l.created_by
    LEFT JOIN library_members lm ON lm.library_id = l.id
    LEFT JOIN books b ON b.library_id = l.id
    LEFT JOIN borrow_requests br ON br.book_id = b.id
    GROUP BY l.id, u.full_name, u.email
    ORDER BY l.created_at DESC;
  `;

  const result = await db.query(query);
  return result.rows.map((r) => ({
    ...r,
    total_members: parseInt(r.total_members || 0, 10),
    total_books: parseInt(r.total_books || 0, 10),
    active_requests: parseInt(r.active_requests || 0, 10),
  }));
}

/**
 * Sets the status of a library (ACTIVE, SUSPENDED, DEACTIVATED).
 */
async function updateLibraryStatus(libraryId, newStatus) {
  const allowed = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
  const normalized = (newStatus || '').toUpperCase().trim();

  if (!allowed.includes(normalized)) {
    const err = new Error(`Invalid status. Must be one of: ${allowed.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const query = `
    UPDATE libraries
    SET status = $1
    WHERE id = $2
    RETURNING id, name, status, society_locality, city;
  `;

  const result = await db.query(query, [normalized, libraryId]);
  if (result.rowCount === 0) {
    const err = new Error('Library not found.');
    err.statusCode = 404;
    throw err;
  }

  return result.rows[0];
}

/**
 * Permanently removes a suspicious or discarded library and all associated data in a transaction.
 */
async function deleteLibrary(libraryId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check library exists
    const check = await client.query('SELECT id, name FROM libraries WHERE id = $1;', [libraryId]);
    if (check.rowCount === 0) {
      const err = new Error('Library not found.');
      err.statusCode = 404;
      throw err;
    }
    const libraryName = check.rows[0].name;

    // Delete chat messages related to books in this library
    await client.query(`
      DELETE FROM chat_messages 
      WHERE borrow_request_id IN (
        SELECT br.id FROM borrow_requests br
        JOIN books b ON b.id = br.book_id
        WHERE b.library_id = $1
      );
    `, [libraryId]);

    // Delete custody history related to books in this library
    await client.query(`
      DELETE FROM custody_history
      WHERE book_id IN (SELECT id FROM books WHERE library_id = $1);
    `, [libraryId]);

    // Delete handover sessions related to books in this library
    await client.query(`
      DELETE FROM handover_sessions
      WHERE borrow_request_id IN (
        SELECT br.id FROM borrow_requests br
        JOIN books b ON b.id = br.book_id
        WHERE b.library_id = $1
      );
    `, [libraryId]);

    // Delete borrow requests related to books in this library
    await client.query(`
      DELETE FROM borrow_requests
      WHERE book_id IN (SELECT id FROM books WHERE library_id = $1);
    `, [libraryId]);

    // Delete books in this library
    await client.query('DELETE FROM books WHERE library_id = $1;', [libraryId]);

    // Delete library (cascades to library_members, notices, ledger, demands)
    await client.query('DELETE FROM libraries WHERE id = $1;', [libraryId]);

    await client.query('COMMIT');
    return { success: true, deletedLibraryId: libraryId, libraryName };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns global platform summary metrics.
 */
async function getPlatformStats() {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM libraries) AS total_libraries,
      (SELECT COUNT(*) FROM libraries WHERE status = 'ACTIVE') AS active_libraries,
      (SELECT COUNT(*) FROM libraries WHERE status = 'SUSPENDED') AS suspended_libraries,
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM books WHERE status != 'REMOVED') AS total_books,
      (SELECT COUNT(*) FROM borrow_requests WHERE status IN ('ACTIVE', 'HANDOVER_PENDING')) AS active_handovers;
  `;

  const res = await db.query(query);
  const row = res.rows[0];

  return {
    totalLibraries: parseInt(row.total_libraries || 0, 10),
    activeLibraries: parseInt(row.active_libraries || 0, 10),
    suspendedLibraries: parseInt(row.suspended_libraries || 0, 10),
    totalUsers: parseInt(row.total_users || 0, 10),
    totalBooks: parseInt(row.total_books || 0, 10),
    activeHandovers: parseInt(row.active_handovers || 0, 10),
  };
}

module.exports = {
  listAllLibraries,
  updateLibraryStatus,
  deleteLibrary,
  getPlatformStats,
};
