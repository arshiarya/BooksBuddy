const crypto = require('crypto');
const db = require('../../config/db');

/**
 * Generates a URL-friendly slug from a library name and ensures uniqueness.
 * @param {string} name 
 * @returns {Promise<string>}
 */
async function generateUniqueSlug(name) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let candidateSlug = baseSlug || 'library';
  let counter = 1;

  while (true) {
    const existing = await db.query(
      'SELECT id FROM libraries WHERE slug = $1;',
      [candidateSlug]
    );

    if (existing.rowCount === 0) {
      return candidateSlug;
    }

    candidateSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

/**
 * Generates an 8-character uppercase private invite code.
 * @returns {string}
 */
function generateInviteCode() {
  return `LIB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Discover and search libraries with locality, city, query filtering and pagination.
 */
async function searchLibraries({
  q = '',
  locality = '',
  city = '',
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  // Only active libraries appear in public search/discovery
  conditions.push("COALESCE(l.status, 'ACTIVE') = 'ACTIVE'");

  if (q && q.trim()) {
    conditions.push(`(l.name ILIKE $${paramIdx} OR l.society_locality ILIKE $${paramIdx} OR l.city ILIKE $${paramIdx} OR l.description ILIKE $${paramIdx})`);
    params.push(`%${q.trim()}%`);
    paramIdx += 1;
  }

  if (locality && locality.trim()) {
    conditions.push(`l.society_locality ILIKE $${paramIdx}`);
    params.push(`%${locality.trim()}%`);
    paramIdx += 1;
  }

  if (city && city.trim()) {
    conditions.push(`l.city ILIKE $${paramIdx}`);
    params.push(`%${city.trim()}%`);
    paramIdx += 1;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM libraries l
    ${whereClause};
  `;

  const dataQuery = `
    SELECT l.id, l.name, l.slug, l.society_locality, l.city, l.description, l.is_verified, l.status,
           l.max_borrow_days, l.handover_window_hours, l.max_books_per_member, l.max_renewals,
           l.created_at,
           COUNT(DISTINCT b.id) FILTER (WHERE b.status != 'REMOVED') AS total_books,
           COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'APPROVED') AS approved_members_count
    FROM libraries l
    LEFT JOIN books b ON b.library_id = l.id
    LEFT JOIN library_members lm ON lm.library_id = l.id
    ${whereClause}
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;

  const [countResult, dataResult] = await Promise.all([
    db.query(countQuery, params),
    db.query(dataQuery, [...params, safeLimit, offset]),
  ]);

  const total = parseInt(countResult.rows[0]?.total || 0, 10);

  return {
    libraries: dataResult.rows.map((row) => ({
      ...row,
      total_books: parseInt(row.total_books, 10),
      approved_members_count: parseInt(row.approved_members_count, 10),
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
 * Retrieve library details by ID or slug.
 * Exposes invite_code only to approved librarians of that library.
 */
async function getLibraryById(idOrSlug, currentUserId = null) {
  const isNumeric = /^\d+$/.test(idOrSlug);
  const identifierCondition = isNumeric ? 'l.id = $1' : 'l.slug = $1';

  const query = `
    SELECT l.*,
           COUNT(DISTINCT b.id) FILTER (WHERE b.status != 'REMOVED') AS total_books,
           COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'APPROVED') AS approved_members_count
    FROM libraries l
    LEFT JOIN books b ON b.library_id = l.id
    LEFT JOIN library_members lm ON lm.library_id = l.id
    WHERE ${identifierCondition}
    GROUP BY l.id;
  `;

  const result = await db.query(query, [idOrSlug]);
  if (result.rowCount === 0) {
    return null;
  }

  const library = result.rows[0];
  library.total_books = parseInt(library.total_books, 10);
  library.approved_members_count = parseInt(library.approved_members_count, 10);

  // Check current user's membership and permissions
  let userMembership = null;
  let isLibrarian = false;

  if (currentUserId) {
    const memRes = await db.query(
      `SELECT id, role, status, created_at, approved_at
       FROM library_members
       WHERE library_id = $1 AND user_id = $2;`,
      [library.id, currentUserId]
    );

    if (memRes.rowCount > 0) {
      userMembership = memRes.rows[0];
      isLibrarian =
        userMembership.status === 'APPROVED' &&
        ['PRIMARY_LIBRARIAN', 'LIBRARIAN'].includes(userMembership.role);
    }
  }

  // Privacy gate: Shield invite_code from non-librarians
  if (!isLibrarian) {
    delete library.invite_code;
  }

  return {
    ...library,
    userMembership,
  };
}

/**
 * Create a new library and assign the creator as PRIMARY_LIBRARIAN atomically.
 */
async function createLibrary({
  name,
  society_locality,
  city,
  description = '',
  max_borrow_days = 14,
  handover_window_hours = 48,
  max_books_per_member = 3,
  max_renewals = 1,
  userId,
}) {
  const slug = await generateUniqueSlug(name);
  const inviteCode = generateInviteCode();

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Insert library
    const libRes = await client.query(
      `INSERT INTO libraries (
         name, slug, society_locality, city, description, invite_code,
         max_borrow_days, handover_window_hours, max_books_per_member, max_renewals,
         created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *;`,
      [
        name.trim(),
        slug,
        society_locality.trim(),
        city.trim(),
        description.trim(),
        inviteCode,
        parseInt(max_borrow_days, 10) || 14,
        parseInt(handover_window_hours, 10) || 48,
        parseInt(max_books_per_member, 10) || 3,
        parseInt(max_renewals, 10) || 1,
        userId,
      ]
    );

    const library = libRes.rows[0];

    // 2. Creator automatically becomes PRIMARY_LIBRARIAN with APPROVED status
    const memRes = await client.query(
      `INSERT INTO library_members (
         library_id, user_id, role, status, approved_by, approved_at
       ) VALUES ($1, $2, 'PRIMARY_LIBRARIAN', 'APPROVED', $2, CURRENT_TIMESTAMP)
       RETURNING *;`,
      [library.id, userId]
    );

    await client.query('COMMIT');

    return {
      ...library,
      primaryLibrarianMembership: memRes.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update library rules or details.
 */
async function updateLibrary(libraryId, updates = {}) {
  const allowedFields = {
    name: 'name',
    description: 'description',
    society_locality: 'society_locality',
    city: 'city',
    max_borrow_days: 'max_borrow_days',
    handover_window_hours: 'handover_window_hours',
    max_books_per_member: 'max_books_per_member',
    max_renewals: 'max_renewals',
  };

  const setClauses = [];
  const params = [libraryId];
  let paramIdx = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields[key] && value !== undefined) {
      setClauses.push(`${allowedFields[key]} = $${paramIdx}`);
      params.push(value);
      paramIdx += 1;
    }
  }

  if (setClauses.length === 0) {
    const existing = await db.query('SELECT * FROM libraries WHERE id = $1;', [libraryId]);
    return existing.rows[0];
  }

  const query = `
    UPDATE libraries
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  const res = await db.query(query, params);
  return res.rows[0];
}

/**
 * Apply to join a library (with optional invitation code).
 * Status is ALWAYS 'PENDING' awaiting librarian review.
 */
async function joinLibrary(libraryId, userId, inviteCode = '') {
  // 1. Verify library exists
  const libRes = await db.query(
    'SELECT id, invite_code FROM libraries WHERE id = $1;',
    [libraryId]
  );

  if (libRes.rowCount === 0) {
    const error = new Error('Library not found.');
    error.statusCode = 404;
    throw error;
  }

  const library = libRes.rows[0];

  // 2. If inviteCode provided, validate it matches
  if (inviteCode && inviteCode.trim()) {
    if (library.invite_code && library.invite_code.toUpperCase() !== inviteCode.trim().toUpperCase()) {
      const error = new Error('Invalid invitation code for this library.');
      error.statusCode = 400;
      throw error;
    }
  }

  // 3. Check for existing membership application
  const existing = await db.query(
    'SELECT id, status, role FROM library_members WHERE library_id = $1 AND user_id = $2;',
    [libraryId, userId]
  );

  if (existing.rowCount > 0) {
    const current = existing.rows[0];
    const error = new Error(
      current.status === 'APPROVED'
        ? 'You are already an approved member of this library.'
        : current.status === 'PENDING'
        ? 'Your membership request is already pending librarian approval.'
        : `Your previous membership request was ${current.status.toLowerCase()}.`
    );
    error.statusCode = 409;
    throw error;
  }

  // 4. Insert membership record with status PENDING
  const res = await db.query(
    `INSERT INTO library_members (library_id, user_id, role, status)
     VALUES ($1, $2, 'MEMBER', 'PENDING')
     RETURNING *;`,
    [libraryId, userId]
  );

  return res.rows[0];
}

/**
 * List members of a library with filtering by status and pagination.
 */
async function listMembers(libraryId, { status = '', page = 1, limit = 50 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const conditions = ['lm.library_id = $1'];
  const params = [libraryId];
  let paramIdx = 2;

  if (status && status.trim()) {
    conditions.push(`lm.status = $${paramIdx}`);
    params.push(status.trim().toUpperCase());
    paramIdx += 1;
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM library_members lm
    WHERE ${whereClause};
  `;

  const dataQuery = `
    SELECT lm.id, lm.library_id, lm.user_id, lm.role, lm.status, lm.created_at, lm.approved_at,
           u.email, u.full_name, u.phone, u.society_locality, u.flat_house_number, u.city,
           appr.full_name AS approved_by_name
    FROM library_members lm
    JOIN users u ON u.id = lm.user_id
    LEFT JOIN users appr ON appr.id = lm.approved_by
    WHERE ${whereClause}
    ORDER BY 
      CASE WHEN lm.status = 'PENDING' THEN 1 ELSE 2 END,
      lm.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;

  const [countRes, dataRes] = await Promise.all([
    db.query(countQuery, params),
    db.query(dataQuery, [...params, safeLimit, offset]),
  ]);

  const total = parseInt(countRes.rows[0]?.total || 0, 10);

  return {
    members: dataRes.rows,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Approve/reject membership application or promote/demote librarian role.
 */
async function updateMember(libraryId, memberId, { status, role }, actingUser) {
  // Fetch existing member
  const memRes = await db.query(
    'SELECT * FROM library_members WHERE id = $1 AND library_id = $2;',
    [memberId, libraryId]
  );

  if (memRes.rowCount === 0) {
    const error = new Error('Membership record not found.');
    error.statusCode = 404;
    throw error;
  }

  const member = memRes.rows[0];

  // Role promotion / demotion rules:
  if (role && role !== member.role) {
    // Only PRIMARY_LIBRARIAN can alter librarian roles
    if (actingUser.libraryRole !== 'PRIMARY_LIBRARIAN') {
      const error = new Error('Only the primary librarian can appoint or remove librarians.');
      error.statusCode = 403;
      throw error;
    }

    if (member.role === 'PRIMARY_LIBRARIAN') {
      const error = new Error('Primary librarian role cannot be altered via this endpoint.');
      error.statusCode = 400;
      throw error;
    }

    if (!['LIBRARIAN', 'MEMBER'].includes(role)) {
      const error = new Error('Role must be either LIBRARIAN or MEMBER.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Status transition rules:
  const targetStatus = status ? status.toUpperCase() : member.status;
  const targetRole = role ? role.toUpperCase() : member.role;

  if (status && !['APPROVED', 'REJECTED', 'SUSPENDED'].includes(targetStatus)) {
    const error = new Error('Status must be APPROVED, REJECTED, or SUSPENDED.');
    error.statusCode = 400;
    throw error;
  }

  const approvedBy = targetStatus === 'APPROVED' ? actingUser.id : member.approved_by;
  const approvedAt = targetStatus === 'APPROVED' ? new Date() : member.approved_at;

  const updateRes = await db.query(
    `UPDATE library_members
     SET status = $1, role = $2, approved_by = $3, approved_at = $4
     WHERE id = $5 AND library_id = $6
     RETURNING *;`,
    [targetStatus, targetRole, approvedBy, approvedAt, memberId, libraryId]
  );

  return updateRes.rows[0];
}

/**
 * Regenerate the private invitation code for a library.
 */
async function regenerateInviteCode(libraryId) {
  const newCode = generateInviteCode();

  const res = await db.query(
    `UPDATE libraries
     SET invite_code = $1
     WHERE id = $2
     RETURNING id, name, invite_code;`,
    [newCode, libraryId]
  );

  if (res.rowCount === 0) {
    const error = new Error('Library not found.');
    error.statusCode = 404;
    throw error;
  }

  return res.rows[0];
}

module.exports = {
  searchLibraries,
  getLibraryById,
  createLibrary,
  updateLibrary,
  joinLibrary,
  listMembers,
  updateMember,
  regenerateInviteCode,
};
