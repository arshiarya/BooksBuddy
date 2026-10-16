const db = require('../../config/db');

/**
 * Phase 8: Community Features Service
 * Handles Book Demand Wishlists with upvoting, Financial Ledger, and Community Notices.
 */

const VALID_DEMAND_STATUSES = ['REQUESTED', 'APPROVED_FOR_PURCHASE', 'PURCHASED', 'DECLINED'];
const VALID_LEDGER_TYPES = ['DONATION', 'EXPENSE'];

// ─── 1. Book Demand Wishlist ─────────────────────────────

/**
 * Lists book demands for a library with pagination and user vote indication.
 */
async function listDemands(libraryId, userId, { status = '', page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = ['bd.library_id = $1'];
  const params = [libraryId];
  let paramIdx = 2;

  if (status && status.trim()) {
    conditions.push(`bd.status = $${paramIdx}`);
    params.push(status.trim().toUpperCase());
    paramIdx += 1;
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM book_demands bd
    WHERE ${whereClause};
  `;

  const dataQuery = `
    SELECT bd.id, bd.library_id, bd.title, bd.author, bd.isbn, bd.status,
           bd.upvotes_count, bd.librarian_notes, bd.created_at,
           u.id AS suggested_by_id, u.full_name AS suggested_by_name,
           EXISTS(
             SELECT 1 FROM book_demand_votes bdv
             WHERE bdv.demand_id = bd.id AND bdv.user_id = $${paramIdx}
           ) AS has_voted
    FROM book_demands bd
    JOIN users u ON u.id = bd.suggested_by
    WHERE ${whereClause}
    ORDER BY bd.upvotes_count DESC, bd.created_at DESC
    LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2};
  `;

  const [countRes, dataRes] = await Promise.all([
    db.query(countQuery, params),
    db.query(dataQuery, [...params, userId, safeLimit, offset]),
  ]);

  const total = parseInt(countRes.rows[0]?.total || 0, 10);

  return {
    demands: dataRes.rows.map((row) => ({
      ...row,
      upvotes_count: parseInt(row.upvotes_count, 10),
      has_voted: Boolean(row.has_voted),
    })),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Submits a new book demand with the creator's initial upvote cast atomically.
 */
async function createDemand(libraryId, userId, { title, author, isbn = null }) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    const error = new Error('Book title is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!author || typeof author !== 'string' || !author.trim()) {
    const error = new Error('Book author is required.');
    error.statusCode = 400;
    throw error;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Insert demand with initial upvotes_count = 1
    const insertRes = await client.query(
      `INSERT INTO book_demands (
         library_id, suggested_by, title, author, isbn, status, upvotes_count
       ) VALUES ($1, $2, $3, $4, $5, 'REQUESTED', 1)
       RETURNING *;`,
      [
        libraryId,
        userId,
        title.trim(),
        author.trim(),
        isbn ? isbn.trim() : null,
      ]
    );

    const demand = insertRes.rows[0];

    // Record the creator's automatic upvote
    await client.query(
      `INSERT INTO book_demand_votes (demand_id, user_id)
       VALUES ($1, $2);`,
      [demand.id, userId]
    );

    await client.query('COMMIT');

    return {
      ...demand,
      upvotes_count: 1,
      has_voted: true,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Toggles upvote on a book demand (concurrency-safe with row lock).
 */
async function toggleDemandVote(demandId, userId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock the demand row
    const demandRes = await client.query(
      `SELECT id, library_id, upvotes_count, status
       FROM book_demands
       WHERE id = $1
       FOR UPDATE;`,
      [demandId]
    );

    if (demandRes.rowCount === 0) {
      const error = new Error('Book demand not found.');
      error.statusCode = 404;
      throw error;
    }

    const demand = demandRes.rows[0];

    // Verify user is an approved member of this demand's library
    const memRes = await client.query(
      `SELECT id FROM library_members
       WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED';`,
      [demand.library_id, userId]
    );

    if (memRes.rowCount === 0) {
      const error = new Error('You must be an approved member to vote on book demands.');
      error.statusCode = 403;
      throw error;
    }

    // 2. Check if vote exists
    const voteCheck = await client.query(
      `SELECT demand_id FROM book_demand_votes
       WHERE demand_id = $1 AND user_id = $2;`,
      [demandId, userId]
    );

    let hasVoted = false;
    let newCount = demand.upvotes_count;

    if (voteCheck.rowCount > 0) {
      // Remove vote
      await client.query(
        `DELETE FROM book_demand_votes WHERE demand_id = $1 AND user_id = $2;`,
        [demandId, userId]
      );
      newCount = Math.max(0, demand.upvotes_count - 1);
      hasVoted = false;
    } else {
      // Add vote
      await client.query(
        `INSERT INTO book_demand_votes (demand_id, user_id) VALUES ($1, $2);`,
        [demandId, userId]
      );
      newCount = demand.upvotes_count + 1;
      hasVoted = true;
    }

    // Update count in book_demands
    await client.query(
      `UPDATE book_demands SET upvotes_count = $1 WHERE id = $2;`,
      [newCount, demandId]
    );

    await client.query('COMMIT');

    return {
      demandId: parseInt(demandId, 10),
      hasVoted,
      upvotes_count: newCount,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Updates status of a book demand (Librarian only).
 */
async function updateDemandStatus(demandId, userId, { status, librarian_notes }) {
  if (!status || !VALID_DEMAND_STATUSES.includes(status.toUpperCase())) {
    const error = new Error(`Status must be one of: ${VALID_DEMAND_STATUSES.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  const demandRes = await db.query(
    `SELECT id, library_id FROM book_demands WHERE id = $1;`,
    [demandId]
  );

  if (demandRes.rowCount === 0) {
    const error = new Error('Book demand not found.');
    error.statusCode = 404;
    throw error;
  }

  const demand = demandRes.rows[0];

  // Verify librarian role
  const libRes = await db.query(
    `SELECT id FROM library_members
     WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED'
       AND role IN ('PRIMARY_LIBRARIAN', 'LIBRARIAN');`,
    [demand.library_id, userId]
  );

  if (libRes.rowCount === 0) {
    const error = new Error('Librarian privileges required to update demand status.');
    error.statusCode = 403;
    throw error;
  }

  const updateRes = await db.query(
    `UPDATE book_demands
     SET status = $1, librarian_notes = $2
     WHERE id = $3
     RETURNING *;`,
    [status.toUpperCase(), librarian_notes ? librarian_notes.trim() : null, demandId]
  );

  return updateRes.rows[0];
}

// ─── 2. Voluntary Contributions Ledger ────────────────────

/**
 * Retrieves ledger records and summary totals for a library.
 */
async function getLedger(libraryId, { page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  // 1. Calculate financial summary totals
  const summaryQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'DONATION' THEN amount ELSE 0 END), 0) AS total_donations,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS total_expenses,
      COUNT(*) AS total_entries
    FROM contributions_ledger
    WHERE library_id = $1;
  `;

  // 2. Retrieve paginated entries
  const dataQuery = `
    SELECT cl.id, cl.library_id, cl.type, cl.amount, cl.description, cl.recorded_at,
           cl.user_id, contributor.full_name AS contributor_name,
           cl.recorded_by, recorder.full_name AS recorded_by_name
    FROM contributions_ledger cl
    LEFT JOIN users contributor ON contributor.id = cl.user_id
    JOIN users recorder ON recorder.id = cl.recorded_by
    WHERE cl.library_id = $1
    ORDER BY cl.recorded_at DESC, cl.id DESC
    LIMIT $2 OFFSET $3;
  `;

  const [summaryRes, dataRes] = await Promise.all([
    db.query(summaryQuery, [libraryId]),
    db.query(dataQuery, [libraryId, safeLimit, offset]),
  ]);

  const summary = summaryRes.rows[0];
  const totalDonations = parseFloat(summary.total_donations);
  const totalExpenses = parseFloat(summary.total_expenses);
  const totalEntries = parseInt(summary.total_entries, 10);
  const netBalance = parseFloat((totalDonations - totalExpenses).toFixed(2));

  return {
    summary: {
      totalDonations,
      totalExpenses,
      netBalance,
      totalEntries,
    },
    entries: dataRes.rows.map((r) => ({
      ...r,
      amount: parseFloat(r.amount),
    })),
    pagination: {
      total: totalEntries,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalEntries / safeLimit),
    },
  };
}

/**
 * Records a financial entry (donation or expense) in the ledger (Librarian only).
 */
async function createLedgerEntry(libraryId, librarianId, { type, amount, description, user_id = null }) {
  if (!type || !VALID_LEDGER_TYPES.includes(type.toUpperCase())) {
    const error = new Error(`Type must be one of: ${VALID_LEDGER_TYPES.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    const error = new Error('Amount must be a positive number.');
    error.statusCode = 400;
    throw error;
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    const error = new Error('A valid description is required.');
    error.statusCode = 400;
    throw error;
  }

  // If user_id provided, verify user exists
  if (user_id) {
    const userRes = await db.query('SELECT id FROM users WHERE id = $1;', [user_id]);
    if (userRes.rowCount === 0) {
      const error = new Error('Contributing user not found.');
      error.statusCode = 404;
      throw error;
    }
  }

  const insertRes = await db.query(
    `INSERT INTO contributions_ledger (
       library_id, user_id, type, amount, description, recorded_by
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *;`,
    [
      libraryId,
      user_id || null,
      type.toUpperCase(),
      parsedAmount.toFixed(2),
      description.trim(),
      librarianId,
    ]
  );

  return {
    ...insertRes.rows[0],
    amount: parseFloat(insertRes.rows[0].amount),
  };
}

// ─── 3. Community Notices ─────────────────────────────────

/**
 * Lists active non-expired community notices for a library.
 */
async function listNotices(libraryId, { category = '', includeExpired = false } = {}) {
  const conditions = ['cn.library_id = $1', 'cn.is_removed = FALSE'];
  const params = [libraryId];
  let paramIdx = 2;

  if (!includeExpired) {
    conditions.push('cn.expires_at > CURRENT_TIMESTAMP');
  }

  if (category && category.trim()) {
    conditions.push(`cn.category ILIKE $${paramIdx}`);
    params.push(category.trim());
    paramIdx += 1;
  }

  const query = `
    SELECT cn.id, cn.library_id, cn.author_id, cn.title, cn.description,
           cn.category, cn.contact_info, cn.image_url, cn.expires_at, cn.created_at,
           u.full_name AS author_name
    FROM community_notices cn
    JOIN users u ON u.id = cn.author_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY cn.created_at DESC;
  `;

  const res = await db.query(query, params);
  return res.rows;
}

/**
 * Posts a community notice (any approved library member).
 */
async function createNotice(libraryId, authorId, {
  title,
  description,
  category,
  contact_info,
  image_url = null,
  expires_at,
}) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    const error = new Error('Notice title is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    const error = new Error('Notice description is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!category || typeof category !== 'string' || !category.trim()) {
    const error = new Error('Notice category is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!contact_info || typeof contact_info !== 'string' || !contact_info.trim()) {
    const error = new Error('Contact info is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!expires_at) {
    const error = new Error('Expiration date (expires_at) is required.');
    error.statusCode = 400;
    throw error;
  }

  const expDate = new Date(expires_at);
  if (isNaN(expDate.getTime()) || expDate <= new Date()) {
    const error = new Error('Expiration date must be a valid future timestamp.');
    error.statusCode = 400;
    throw error;
  }

  const insertRes = await db.query(
    `INSERT INTO community_notices (
       library_id, author_id, title, description, category, contact_info, image_url, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *;`,
    [
      libraryId,
      authorId,
      title.trim(),
      description.trim(),
      category.trim().toUpperCase(),
      contact_info.trim(),
      image_url ? image_url.trim() : null,
      expDate.toISOString(),
    ]
  );

  return insertRes.rows[0];
}

/**
 * Removes a community notice (Author or Librarian).
 */
async function removeNotice(noticeId, userId) {
  const noticeRes = await db.query(
    `SELECT id, library_id, author_id, is_removed FROM community_notices WHERE id = $1;`,
    [noticeId]
  );

  if (noticeRes.rowCount === 0) {
    const error = new Error('Community notice not found.');
    error.statusCode = 404;
    throw error;
  }

  const notice = noticeRes.rows[0];

  if (notice.is_removed) {
    const error = new Error('Notice has already been removed.');
    error.statusCode = 400;
    throw error;
  }

  // Check if author or librarian
  const isAuthor = notice.author_id === userId;
  let isLibrarian = false;

  if (!isAuthor) {
    const memRes = await db.query(
      `SELECT id FROM library_members
       WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED'
         AND role IN ('PRIMARY_LIBRARIAN', 'LIBRARIAN');`,
      [notice.library_id, userId]
    );
    isLibrarian = memRes.rowCount > 0;
  }

  if (!isAuthor && !isLibrarian) {
    const error = new Error('Only the author or a librarian can remove this notice.');
    error.statusCode = 403;
    throw error;
  }

  const updateRes = await db.query(
    `UPDATE community_notices
     SET is_removed = TRUE, removed_by = $1
     WHERE id = $2
     RETURNING *;`,
    [userId, noticeId]
  );

  return updateRes.rows[0];
}

module.exports = {
  listDemands,
  createDemand,
  toggleDemandVote,
  updateDemandStatus,
  getLedger,
  createLedgerEntry,
  listNotices,
  createNotice,
  removeNotice,
};
