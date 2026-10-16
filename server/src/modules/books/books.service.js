const db = require('../../config/db');

/**
 * Books and Catalogue Service.
 * Manages virtual community collection records, donations, and catalogue searches.
 */

const VALID_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED'];

/**
 * Searches the library catalogue with filters, full-text search, and pagination.
 */
async function searchCatalogue({
  library_id = null,
  q = '',
  genre = '',
  status = '',
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (library_id) {
    conditions.push(`b.library_id = $${paramIdx}`);
    params.push(library_id);
    paramIdx += 1;
  }

  // Filter status: by default exclude REMOVED books
  if (status && status.trim()) {
    conditions.push(`b.status = $${paramIdx}`);
    params.push(status.trim().toUpperCase());
    paramIdx += 1;
  } else {
    conditions.push(`b.status != 'REMOVED'`);
  }

  if (genre && genre.trim()) {
    conditions.push(`b.genre ILIKE $${paramIdx}`);
    params.push(`%${genre.trim()}%`);
    paramIdx += 1;
  }

  if (q && q.trim()) {
    const trimmed = q.trim();
    conditions.push(`(
      to_tsvector('english', b.title || ' ' || b.author) @@ plainto_tsquery('english', $${paramIdx})
      OR b.title ILIKE $${paramIdx + 1}
      OR b.author ILIKE $${paramIdx + 1}
      OR b.isbn = $${paramIdx + 2}
    )`);
    params.push(trimmed, `%${trimmed}%`, trimmed.replace(/[-\s]/g, ''));
    paramIdx += 3;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM books b
    ${whereClause};
  `;

  const dataQuery = `
    SELECT b.id, b.library_id, b.isbn, b.title, b.author, b.cover_image_url,
           b.genre, b.description, b.status, b.created_at,
           l.name AS library_name, l.slug AS library_slug, l.society_locality AS library_locality, l.city AS library_city,
           donor.id AS original_donor_id, donor.full_name AS original_donor_name,
           custodian.id AS current_custodian_id, custodian.full_name AS current_custodian_name,
           custodian.society_locality AS current_custodian_locality, custodian.city AS current_custodian_city,
           COUNT(br.id) FILTER (WHERE br.status = 'QUEUED') AS queue_length
    FROM books b
    JOIN libraries l ON l.id = b.library_id
    JOIN users donor ON donor.id = b.original_donor_id
    JOIN users custodian ON custodian.id = b.current_custodian_id
    LEFT JOIN borrow_requests br ON br.book_id = b.id
    ${whereClause}
    GROUP BY b.id, l.id, donor.id, custodian.id
    ORDER BY b.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;

  const [countRes, dataRes] = await Promise.all([
    db.query(countQuery, params),
    db.query(dataQuery, [...params, safeLimit, offset]),
  ]);

  const total = parseInt(countRes.rows[0]?.total || 0, 10);

  return {
    books: dataRes.rows.map((row) => ({
      ...row,
      queue_length: parseInt(row.queue_length, 10),
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
 * Retrieves detailed information about a book, including its custody history timeline.
 */
async function getBookById(bookId) {
  const query = `
    SELECT b.id, b.library_id, b.isbn, b.title, b.author, b.cover_image_url,
           b.genre, b.description, b.status, b.removal_reason, b.created_at,
           l.name AS library_name, l.slug AS library_slug, l.society_locality AS library_locality, l.city AS library_city,
           donor.id AS original_donor_id, donor.full_name AS original_donor_name,
           custodian.id AS current_custodian_id, custodian.full_name AS current_custodian_name,
           custodian.society_locality AS current_custodian_locality, custodian.city AS current_custodian_city
    FROM books b
    JOIN libraries l ON l.id = b.library_id
    JOIN users donor ON donor.id = b.original_donor_id
    JOIN users custodian ON custodian.id = b.current_custodian_id
    WHERE b.id = $1;
  `;

  const result = await db.query(query, [bookId]);
  if (result.rowCount === 0) {
    return null;
  }

  const book = result.rows[0];

  // Fetch custody history timeline
  const historyQuery = `
    SELECT ch.id, ch.transferred_at, ch.giver_condition_rating, ch.receiver_condition_rating,
           from_u.id AS from_user_id, from_u.full_name AS from_user_name,
           to_u.id AS to_user_id, to_u.full_name AS to_user_name
    FROM custody_history ch
    LEFT JOIN users from_u ON from_u.id = ch.from_user_id
    JOIN users to_u ON to_u.id = ch.to_user_id
    WHERE ch.book_id = $1
    ORDER BY ch.transferred_at DESC;
  `;

  // Fetch queue length
  const queueQuery = `
    SELECT COUNT(*) AS queue_length
    FROM borrow_requests
    WHERE book_id = $1 AND status = 'QUEUED';
  `;

  const [historyRes, queueRes] = await Promise.all([
    db.query(historyQuery, [bookId]),
    db.query(queueQuery, [bookId]),
  ]);

  return {
    ...book,
    custody_history: historyRes.rows,
    queue_length: parseInt(queueRes.rows[0]?.queue_length || 0, 10),
  };
}

/**
 * Donates a personal book to a virtual library collection.
 * Physical custody initially remains with the donating member.
 * Inserts book and initial custody history atomically.
 */
async function donateBook({
  library_id,
  title,
  author,
  isbn = null,
  cover_image_url = null,
  genre = null,
  description = null,
  initial_condition = 'GOOD',
  donor_user_id,
}) {
  // 1. Verify target library exists
  const libRes = await db.query(
    'SELECT id, name FROM libraries WHERE id = $1;',
    [library_id]
  );
  if (libRes.rowCount === 0) {
    const error = new Error('Target library does not exist.');
    error.statusCode = 404;
    throw error;
  }

  // 2. Verify donor is an approved member of this library
  const memRes = await db.query(
    `SELECT id, role, status
     FROM library_members
     WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED';`,
    [library_id, donor_user_id]
  );
  if (memRes.rowCount === 0) {
    const error = new Error('You must be an approved member of this library to donate books.');
    error.statusCode = 403;
    throw error;
  }

  // 3. Condition validation
  const safeCondition = initial_condition ? initial_condition.toUpperCase() : 'GOOD';
  if (!VALID_CONDITIONS.includes(safeCondition)) {
    const error = new Error(`Condition must be one of: ${VALID_CONDITIONS.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Insert book (collection ownership belongs to library; initial custody stays with donor)
    const bookRes = await client.query(
      `INSERT INTO books (
         library_id, isbn, title, author, cover_image_url, genre, description,
         original_donor_id, current_custodian_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 'AVAILABLE')
       RETURNING *;`,
      [
        library_id,
        isbn ? isbn.trim() : null,
        title.trim(),
        author.trim(),
        cover_image_url ? cover_image_url.trim() : null,
        genre ? genre.trim() : null,
        description ? description.trim() : null,
        donor_user_id,
      ]
    );

    const book = bookRes.rows[0];

    // Insert initial custody history record in the exact same transaction
    const custodyRes = await client.query(
      `INSERT INTO custody_history (
         book_id, handover_session_id, from_user_id, to_user_id,
         giver_condition_rating, receiver_condition_rating
       ) VALUES ($1, NULL, NULL, $2, $3, $3)
       RETURNING *;`,
      [book.id, donor_user_id, safeCondition]
    );

    await client.query('COMMIT');

    return {
      book,
      initialCustody: custodyRes.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Removes a book from the library catalogue (Librarian only) with recorded reason.
 */
async function removeBook(bookId, removalReason, librarianUserId) {
  if (!removalReason || typeof removalReason !== 'string' || !removalReason.trim()) {
    const error = new Error('A mandatory removal reason must be recorded.');
    error.statusCode = 400;
    throw error;
  }

  const bookRes = await db.query(
    'SELECT id, library_id, status FROM books WHERE id = $1;',
    [bookId]
  );

  if (bookRes.rowCount === 0) {
    const error = new Error('Book not found.');
    error.statusCode = 404;
    throw error;
  }

  const book = bookRes.rows[0];

  // Prevent removing books with active physical loans
  if (book.status === 'BORROWED') {
    const error = new Error('Cannot remove a book that is currently borrowed by a member. Await its physical return.');
    error.statusCode = 400;
    throw error;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Mark book as REMOVED
    const updateRes = await client.query(
      `UPDATE books
       SET status = 'REMOVED', removal_reason = $1, removed_by = $2
       WHERE id = $3
       RETURNING *;`,
      [removalReason.trim(), librarianUserId, bookId]
    );

    // 2. Automatically cancel any waiting list requests for this book
    await client.query(
      `UPDATE borrow_requests
       SET status = 'CANCELLED'
       WHERE book_id = $1 AND status IN ('QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING');`,
      [bookId]
    );

    await client.query('COMMIT');

    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  searchCatalogue,
  getBookById,
  donateBook,
  removeBook,
};
