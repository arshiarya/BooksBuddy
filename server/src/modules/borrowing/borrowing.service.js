const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { broadcastHandoverStatus } = require('../../sockets/socketServer');

/**
 * Phase 6: Borrowing, FIFO Queue, PIN Handover & Custody Service.
 *
 * Concurrency model:
 *   All state transitions acquire row-level locks in the canonical order:
 *     books  →  borrow_requests  →  handover_sessions
 *   This prevents deadlocks and ensures serializable custody changes.
 *
 * PIN security:
 *   - 4-digit one-time PIN generated via crypto.randomInt (uniform distribution)
 *   - Stored as bcrypt hash (never plaintext)
 *   - Maximum 3 verification attempts (brute-force protection)
 *   - PIN verified inside the same transaction that performs custody transfer
 */

const PIN_BCRYPT_ROUNDS = 10;
const MAX_PIN_ATTEMPTS = 3;
const VALID_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED'];

// ─── Helpers ──────────────────────────────────────────────

/**
 * Generates a cryptographically secure 4-digit PIN string and its bcrypt hash.
 * @returns {Promise<{pin: string, pinHash: string}>}
 */
async function generatePinAndHash() {
  const pinNum = crypto.randomInt(0, 10000); // 0..9999 inclusive
  const pin = String(pinNum).padStart(4, '0');
  const pinHash = await bcrypt.hash(pin, PIN_BCRYPT_ROUNDS);
  return { pin, pinHash };
}

/**
 * Centralized FIFO queue advancement.
 * Called whenever a borrow_request reaches a terminal state
 * (DECLINED, CANCELLED, EXPIRED, FAILED).
 *
 * Must be called WITHIN an existing transaction (using the supplied client).
 *
 * Lock order: book row (already locked by caller) → borrow_requests → handover_sessions.
 *
 * @param {import('pg').PoolClient} client - transactional client
 * @param {number} bookId
 * @param {number} libraryId - library to load rules from
 * @returns {Promise<{promoted: boolean, borrowRequestId?: number, handoverSessionId?: number, pin?: string}>}
 */
async function advanceQueue(client, bookId, libraryId) {
  // 1. Verify no other active/pending request exists (idempotency guard)
  const activeCheck = await client.query(
    `SELECT id FROM borrow_requests
     WHERE book_id = $1
       AND status IN ('CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE')
     FOR UPDATE;`,
    [bookId]
  );

  if (activeCheck.rowCount > 0) {
    // Another request is already active/pending – do not promote
    return { promoted: false };
  }

  // 2. Find earliest eligible QUEUED request (FIFO by created_at, then id)
  const queueRes = await client.query(
    `SELECT br.id, br.borrower_id
     FROM borrow_requests br
     WHERE br.book_id = $1 AND br.status = 'QUEUED'
     ORDER BY br.created_at ASC, br.id ASC
     FOR UPDATE;`,
    [bookId]
  );

  if (queueRes.rowCount === 0) {
    // Queue empty → set book back to AVAILABLE
    await client.query(
      `UPDATE books SET status = 'AVAILABLE' WHERE id = $1;`,
      [bookId]
    );
    return { promoted: false };
  }

  // 3. Load library rules for eligibility re-check
  const rulesRes = await client.query(
    `SELECT max_borrow_days, handover_window_hours, max_books_per_member
     FROM libraries WHERE id = $1;`,
    [libraryId]
  );
  const rules = rulesRes.rows[0];

  // 4. Walk the queue and find first eligible member
  for (const candidate of queueRes.rows) {
    // Re-check membership
    const memCheck = await client.query(
      `SELECT id FROM library_members
       WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED';`,
      [libraryId, candidate.borrower_id]
    );

    if (memCheck.rowCount === 0) {
      // No longer an approved member → expire this request
      await client.query(
        `UPDATE borrow_requests SET status = 'EXPIRED' WHERE id = $1;`,
        [candidate.id]
      );
      continue;
    }

    // Re-check active borrow count vs max_books_per_member
    const activeCountRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM borrow_requests br
       JOIN books b ON b.id = br.book_id
       WHERE br.borrower_id = $1 AND b.library_id = $2
         AND br.status IN ('ACTIVE', 'HANDOVER_PENDING', 'CUSTODIAN_APPROVAL_PENDING');`,
      [candidate.borrower_id, libraryId]
    );
    const activeCount = parseInt(activeCountRes.rows[0].cnt, 10);

    if (activeCount >= rules.max_books_per_member) {
      // Exceeds limit → skip (leave QUEUED for now – they may free a slot later)
      continue;
    }

    // 5. Promote this candidate: QUEUED → HANDOVER_PENDING
    await client.query(
      `UPDATE borrow_requests SET status = 'HANDOVER_PENDING' WHERE id = $1;`,
      [candidate.id]
    );

    // Get current custodian
    const bookRow = await client.query(
      `SELECT current_custodian_id FROM books WHERE id = $1;`,
      [bookId]
    );
    const giverId = bookRow.rows[0].current_custodian_id;

    // Set book to RESERVED
    await client.query(
      `UPDATE books SET status = 'RESERVED' WHERE id = $1;`,
      [bookId]
    );

    // 6. Create handover session with fresh PIN
    const { pin, pinHash } = await generatePinAndHash();
    const expiresAt = new Date(
      Date.now() + rules.handover_window_hours * 60 * 60 * 1000
    );

    const hsRes = await client.query(
      `INSERT INTO handover_sessions (
         borrow_request_id, book_id, giver_user_id, receiver_user_id,
         pin_hash, attempts_left, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
       RETURNING id;`,
      [candidate.id, bookId, giverId, candidate.borrower_id, pinHash, MAX_PIN_ATTEMPTS, expiresAt]
    );

    return {
      promoted: true,
      borrowRequestId: candidate.id,
      handoverSessionId: hsRes.rows[0].id,
      pin,
    };
  }

  // All queued candidates are ineligible – book returns to AVAILABLE
  await client.query(
    `UPDATE books SET status = 'AVAILABLE' WHERE id = $1;`,
    [bookId]
  );
  return { promoted: false };
}

// ─── Create Borrow Request ───────────────────────────────

/**
 * Creates a borrow request for a book.
 * - If the book is AVAILABLE: direct flow → CUSTODIAN_APPROVAL_PENDING
 * - If the book is BORROWED/RESERVED: waitlist flow → QUEUED
 *
 * Eligibility checks:
 * - Must be an approved library member
 * - Must not be the current custodian
 * - Must not exceed max_books_per_member
 * - Must not have an existing active/pending/queued request for this book
 *
 * @returns {{request: object, position?: number}}
 */
async function createBorrowRequest(bookId, borrowerId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock the book row
    const bookRes = await client.query(
      `SELECT b.id, b.library_id, b.status, b.current_custodian_id
       FROM books b
       WHERE b.id = $1
       FOR UPDATE;`,
      [bookId]
    );

    if (bookRes.rowCount === 0) {
      const error = new Error('Book not found.');
      error.statusCode = 404;
      throw error;
    }

    const book = bookRes.rows[0];

    if (book.status === 'REMOVED') {
      const error = new Error('This book has been removed from the library.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Verify borrower is approved member
    const memRes = await client.query(
      `SELECT id FROM library_members
       WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED';`,
      [book.library_id, borrowerId]
    );

    if (memRes.rowCount === 0) {
      const error = new Error('You must be an approved member of this library to borrow books.');
      error.statusCode = 403;
      throw error;
    }

    // 3. Cannot borrow your own custodial book
    if (book.current_custodian_id === borrowerId) {
      const error = new Error('You are already the current custodian of this book.');
      error.statusCode = 400;
      throw error;
    }

    // 4. Check for existing request for this user/book
    const existingRes = await client.query(
      `SELECT id, status FROM borrow_requests
       WHERE book_id = $1 AND borrower_id = $2
         AND status IN ('QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE')
       FOR UPDATE;`,
      [bookId, borrowerId]
    );

    if (existingRes.rowCount > 0) {
      const error = new Error('You already have an active or pending request for this book.');
      error.statusCode = 409;
      throw error;
    }

    // 5. Load library rules
    const rulesRes = await client.query(
      `SELECT max_books_per_member FROM libraries WHERE id = $1;`,
      [book.library_id]
    );
    const maxBooks = rulesRes.rows[0].max_books_per_member;

    // 6. Check active borrow count
    const activeCountRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM borrow_requests br
       JOIN books bk ON bk.id = br.book_id
       WHERE br.borrower_id = $1 AND bk.library_id = $2
         AND br.status IN ('ACTIVE', 'HANDOVER_PENDING', 'CUSTODIAN_APPROVAL_PENDING');`,
      [borrowerId, book.library_id]
    );
    const activeCount = parseInt(activeCountRes.rows[0].cnt, 10);

    if (activeCount >= maxBooks) {
      const error = new Error(
        `You have reached the maximum borrowing limit (${maxBooks}) for this library.`
      );
      error.statusCode = 400;
      throw error;
    }

    // 7. Determine flow based on book status
    let newStatus;
    if (book.status === 'AVAILABLE') {
      newStatus = 'CUSTODIAN_APPROVAL_PENDING';
    } else {
      // BORROWED or RESERVED → queue
      newStatus = 'QUEUED';
    }

    const insertRes = await client.query(
      `INSERT INTO borrow_requests (book_id, borrower_id, status)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [bookId, borrowerId, newStatus]
    );

    const borrowRequest = insertRes.rows[0];

    // If direct flow, set book status to RESERVED
    if (newStatus === 'CUSTODIAN_APPROVAL_PENDING') {
      await client.query(
        `UPDATE books SET status = 'RESERVED' WHERE id = $1;`,
        [bookId]
      );
    }

    // Compute queue position if queued
    let position = null;
    if (newStatus === 'QUEUED') {
      const posRes = await client.query(
        `WITH target AS (
           SELECT created_at, id FROM borrow_requests WHERE id = $2
         )
         SELECT COUNT(*) AS pos
         FROM borrow_requests br, target
         WHERE br.book_id = $1 AND br.status = 'QUEUED'
           AND (br.created_at < target.created_at OR (br.created_at = target.created_at AND br.id <= target.id));`,
        [bookId, borrowRequest.id]
      );
      position = parseInt(posRes.rows[0]?.pos || 0, 10);
    }

    await client.query('COMMIT');

    return { request: borrowRequest, position };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Get Borrow Request ──────────────────────────────────

/**
 * Retrieves a borrow request with relevant metadata.
 * Enforces privacy: only borrower, custodian, or librarian may view.
 */
async function getBorrowRequest(requestId, userId) {
  const res = await db.query(
    `SELECT br.*,
            b.title AS book_title, b.author AS book_author, b.library_id,
            b.current_custodian_id, b.status AS book_status,
            borrower.full_name AS borrower_name,
            custodian.full_name AS custodian_name
     FROM borrow_requests br
     JOIN books b ON b.id = br.book_id
     JOIN users borrower ON borrower.id = br.borrower_id
     JOIN users custodian ON custodian.id = b.current_custodian_id
     WHERE br.id = $1;`,
    [requestId]
  );

  if (res.rowCount === 0) {
    const error = new Error('Borrow request not found.');
    error.statusCode = 404;
    throw error;
  }

  const request = res.rows[0];

  // Authorization: borrower, current custodian, or librarian
  const isParticipant =
    request.borrower_id === userId || request.current_custodian_id === userId;

  if (!isParticipant) {
    // Check if librarian
    const libCheck = await db.query(
      `SELECT id FROM library_members
       WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED'
         AND role IN ('PRIMARY_LIBRARIAN', 'LIBRARIAN');`,
      [request.library_id, userId]
    );
    if (libCheck.rowCount === 0) {
      const error = new Error('You are not authorized to view this borrow request.');
      error.statusCode = 403;
      throw error;
    }
  }

  // Include handover session info if exists
  const hsRes = await db.query(
    `SELECT id, status, attempts_left, giver_condition_rating, giver_confirmed_at,
            receiver_condition_rating, receiver_confirmed_at, expires_at, verified_at, created_at
     FROM handover_sessions
     WHERE borrow_request_id = $1
     ORDER BY created_at DESC LIMIT 1;`,
    [requestId]
  );

  // Queue position if QUEUED
  let position = null;
  if (request.status === 'QUEUED') {
    const posRes = await db.query(
      `WITH target AS (
         SELECT created_at, id FROM borrow_requests WHERE id = $2
       )
       SELECT COUNT(*) AS pos
       FROM borrow_requests br, target
       WHERE br.book_id = $1 AND br.status = 'QUEUED'
         AND (br.created_at < target.created_at OR (br.created_at = target.created_at AND br.id <= target.id));`,
      [request.book_id, request.id]
    );
    position = parseInt(posRes.rows[0]?.pos || 0, 10);
  }

  return {
    ...request,
    handover_session: hsRes.rowCount > 0 ? hsRes.rows[0] : null,
    queue_position: position,
  };
}

// ─── Custodian Approve / Decline ─────────────────────────

/**
 * Custodian approves a borrow request (CUSTODIAN_APPROVAL_PENDING → HANDOVER_PENDING).
 * Creates a handover session with a fresh PIN.
 */
async function approveBorrowRequest(requestId, custodianUserId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 0. Initial non-locking snapshot check to find book_id
    const brCheck = await client.query(
      `SELECT br.id, br.book_id, br.borrower_id, br.status
       FROM borrow_requests br
       WHERE br.id = $1;`,
      [requestId]
    );

    if (brCheck.rowCount === 0) {
      const error = new Error('Borrow request not found.');
      error.statusCode = 404;
      throw error;
    }

    const preBr = brCheck.rows[0];

    if (preBr.status !== 'CUSTODIAN_APPROVAL_PENDING') {
      const error = new Error(`Cannot approve: request is in ${preBr.status} state.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Lock the book first (canonical lock order: books → borrow_requests → handover_sessions)
    const bookRes = await client.query(
      `SELECT id, current_custodian_id, library_id FROM books WHERE id = $1 FOR UPDATE;`,
      [preBr.book_id]
    );

    const book = bookRes.rows[0];

    if (book.current_custodian_id !== custodianUserId) {
      const error = new Error('Only the current custodian can approve this request.');
      error.statusCode = 403;
      throw error;
    }

    // 2. Lock the borrow_request second
    const brRes = await client.query(
      `SELECT br.id, br.book_id, br.borrower_id, br.status
       FROM borrow_requests br
       WHERE br.id = $1
       FOR UPDATE;`,
      [requestId]
    );

    const br = brRes.rows[0];

    if (br.status !== 'CUSTODIAN_APPROVAL_PENDING') {
      const error = new Error(`Cannot approve: request is in ${br.status} state.`);
      error.statusCode = 400;
      throw error;
    }

    // Load handover window from library rules
    const rulesRes = await client.query(
      `SELECT handover_window_hours FROM libraries WHERE id = $1;`,
      [book.library_id]
    );
    const handoverWindowHours = rulesRes.rows[0].handover_window_hours;

    // Transition: CUSTODIAN_APPROVAL_PENDING → HANDOVER_PENDING
    await client.query(
      `UPDATE borrow_requests SET status = 'HANDOVER_PENDING' WHERE id = $1;`,
      [requestId]
    );

    // 3. Generate PIN and create handover session
    const { pin, pinHash } = await generatePinAndHash();
    const expiresAt = new Date(Date.now() + handoverWindowHours * 60 * 60 * 1000);

    const hsRes = await client.query(
      `INSERT INTO handover_sessions (
         borrow_request_id, book_id, giver_user_id, receiver_user_id,
         pin_hash, attempts_left, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
       RETURNING id;`,
      [requestId, br.book_id, custodianUserId, br.borrower_id, pinHash, MAX_PIN_ATTEMPTS, expiresAt]
    );

    await client.query('COMMIT');

    broadcastHandoverStatus(requestId, 'HANDOVER_PENDING', {
      status: 'HANDOVER_PENDING',
      handoverSessionId: hsRes.rows[0].id,
    });

    return {
      borrowRequest: { id: requestId, status: 'HANDOVER_PENDING' },
      handoverSession: {
        id: hsRes.rows[0].id,
        pin,
        expiresAt,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Custodian declines a borrow request.
 * Triggers queue advancement.
 */
async function declineBorrowRequest(requestId, custodianUserId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 0. Initial non-locking snapshot check to find book_id
    const brCheck = await client.query(
      `SELECT br.id, br.book_id, br.borrower_id, br.status
       FROM borrow_requests br
       WHERE br.id = $1;`,
      [requestId]
    );

    if (brCheck.rowCount === 0) {
      const error = new Error('Borrow request not found.');
      error.statusCode = 404;
      throw error;
    }

    const preBr = brCheck.rows[0];

    if (preBr.status !== 'CUSTODIAN_APPROVAL_PENDING') {
      const error = new Error(`Cannot decline: request is in ${preBr.status} state.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Lock book row first (canonical lock order: books → borrow_requests → handover_sessions)
    const bookRes = await client.query(
      `SELECT id, current_custodian_id, library_id FROM books WHERE id = $1 FOR UPDATE;`,
      [preBr.book_id]
    );

    const book = bookRes.rows[0];

    if (book.current_custodian_id !== custodianUserId) {
      const error = new Error('Only the current custodian can decline this request.');
      error.statusCode = 403;
      throw error;
    }

    // 2. Lock borrow_requests second
    const brRes = await client.query(
      `SELECT br.id, br.book_id, br.borrower_id, br.status
       FROM borrow_requests br
       WHERE br.id = $1
       FOR UPDATE;`,
      [requestId]
    );

    const br = brRes.rows[0];

    if (br.status !== 'CUSTODIAN_APPROVAL_PENDING') {
      const error = new Error(`Cannot decline: request is in ${br.status} state.`);
      error.statusCode = 400;
      throw error;
    }

    // Transition: CUSTODIAN_APPROVAL_PENDING → DECLINED
    await client.query(
      `UPDATE borrow_requests SET status = 'DECLINED' WHERE id = $1;`,
      [requestId]
    );

    // Queue advancement
    const advancement = await advanceQueue(client, br.book_id, book.library_id);

    await client.query('COMMIT');

    broadcastHandoverStatus(requestId, 'DECLINED', {
      status: 'DECLINED',
    });

    return {
      borrowRequest: { id: requestId, status: 'DECLINED' },
      queueAdvancement: advancement,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Cancel Borrow Request ───────────────────────────────

/**
 * Borrower cancels their own request.
 * Triggers queue advancement when relevant.
 */
async function cancelBorrowRequest(requestId, userId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 0. Initial non-locking snapshot check to find book_id and borrower
    const brCheck = await client.query(
      `SELECT br.id, br.book_id, br.borrower_id, br.status
       FROM borrow_requests br
       WHERE br.id = $1;`,
      [requestId]
    );

    if (brCheck.rowCount === 0) {
      const error = new Error('Borrow request not found.');
      error.statusCode = 404;
      throw error;
    }

    const preBr = brCheck.rows[0];

    if (preBr.borrower_id !== userId) {
      const error = new Error('Only the borrower can cancel their own request.');
      error.statusCode = 403;
      throw error;
    }

    const cancellableStates = ['QUEUED', 'CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING'];
    if (!cancellableStates.includes(preBr.status)) {
      const error = new Error(`Cannot cancel: request is in ${preBr.status} state.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Lock book first (canonical lock order: books → borrow_requests → handover_sessions)
    const bookRes = await client.query(
      `SELECT id, library_id FROM books WHERE id = $1 FOR UPDATE;`,
      [preBr.book_id]
    );
    const book = bookRes.rows[0];

    // 2. Lock borrow_request second
    const brRes = await client.query(
      `SELECT br.id, br.book_id, br.borrower_id, br.status
       FROM borrow_requests br
       WHERE br.id = $1
       FOR UPDATE;`,
      [requestId]
    );
    const br = brRes.rows[0];

    if (!cancellableStates.includes(br.status)) {
      const error = new Error(`Cannot cancel: request is in ${br.status} state.`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Cancel any pending handover sessions (handover_sessions)
    await client.query(
      `UPDATE handover_sessions SET status = 'CANCELLED'
       WHERE borrow_request_id = $1 AND status = 'PENDING';`,
      [requestId]
    );

    // Transition to CANCELLED
    await client.query(
      `UPDATE borrow_requests SET status = 'CANCELLED' WHERE id = $1;`,
      [requestId]
    );

    // Queue advancement
    const advancement = await advanceQueue(client, br.book_id, book.library_id);

    await client.query('COMMIT');

    broadcastHandoverStatus(requestId, 'CANCELLED', {
      status: 'CANCELLED',
    });

    return {
      borrowRequest: { id: requestId, status: 'CANCELLED' },
      queueAdvancement: advancement,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Get Handover Session ────────────────────────────────

/**
 * Retrieves handover session details, with address revealed only at the right stage.
 */
async function getHandoverSession(sessionId, userId) {
  const res = await db.query(
    `SELECT hs.*,
            br.borrower_id, br.status AS borrow_status,
            b.title AS book_title, b.library_id, b.current_custodian_id,
            giver.full_name AS giver_name,
            giver.society_locality AS giver_locality, giver.city AS giver_city,
            giver.flat_house_number AS giver_address, giver.phone AS giver_phone,
            receiver.full_name AS receiver_name
     FROM handover_sessions hs
     JOIN borrow_requests br ON br.id = hs.borrow_request_id
     JOIN books b ON b.id = hs.book_id
     JOIN users giver ON giver.id = hs.giver_user_id
     JOIN users receiver ON receiver.id = hs.receiver_user_id
     WHERE hs.id = $1;`,
    [sessionId]
  );

  if (res.rowCount === 0) {
    const error = new Error('Handover session not found.');
    error.statusCode = 404;
    throw error;
  }

  const session = res.rows[0];

  // Authorization: only giver or receiver
  if (session.giver_user_id !== userId && session.receiver_user_id !== userId) {
    const error = new Error('You are not authorized to view this handover session.');
    error.statusCode = 403;
    throw error;
  }

  // Address privacy gate: reveal giver address only to the receiver
  // and only when handover is in PENDING or VERIFIED status
  const result = {
    id: session.id,
    borrow_request_id: session.borrow_request_id,
    book_id: session.book_id,
    book_title: session.book_title,
    giver_user_id: session.giver_user_id,
    giver_name: session.giver_name,
    receiver_user_id: session.receiver_user_id,
    receiver_name: session.receiver_name,
    status: session.status,
    attempts_left: session.attempts_left,
    giver_condition_rating: session.giver_condition_rating,
    giver_confirmed_at: session.giver_confirmed_at,
    receiver_condition_rating: session.receiver_condition_rating,
    receiver_confirmed_at: session.receiver_confirmed_at,
    expires_at: session.expires_at,
    verified_at: session.verified_at,
    created_at: session.created_at,
  };

  // Reveal pickup address only to the approved receiver during PENDING/VERIFIED state
  if (
    userId === session.receiver_user_id &&
    (session.status === 'PENDING' || session.status === 'VERIFIED')
  ) {
    result.pickup_address = {
      society_locality: session.giver_locality,
      city: session.giver_city,
      flat_house_number: session.giver_address,
      phone: session.giver_phone,
    };
  }

  return result;
}

// ─── PIN Verification ────────────────────────────────────

/**
 * Verifies the one-time handover PIN.
 * On success: marks handover session as VERIFIED.
 * On failure: decrements attempts_left; at 0 → FAILED → queue advancement.
 */
async function verifyPin(sessionId, pin, userId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 0. Initial non-locking snapshot check to find related IDs
    const hsCheck = await client.query(
      `SELECT hs.id, hs.borrow_request_id, hs.book_id, hs.receiver_user_id, hs.status
       FROM handover_sessions hs
       WHERE hs.id = $1;`,
      [sessionId]
    );

    if (hsCheck.rowCount === 0) {
      const error = new Error('Handover session not found.');
      error.statusCode = 404;
      throw error;
    }

    const preHs = hsCheck.rows[0];

    // Only the receiver verifies the PIN (receiver enters PIN given by giver)
    if (preHs.receiver_user_id !== userId) {
      const error = new Error('Only the receiver can verify the handover PIN.');
      error.statusCode = 403;
      throw error;
    }

    if (preHs.status !== 'PENDING') {
      const error = new Error(`Handover session is in ${preHs.status} state and cannot be verified.`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Lock book first (canonical lock order: books → borrow_requests → handover_sessions)
    const bookRes = await client.query(
      `SELECT id, library_id, current_custodian_id FROM books WHERE id = $1 FOR UPDATE;`,
      [preHs.book_id]
    );
    const book = bookRes.rows[0];

    // 2. Lock borrow_request second
    await client.query(
      `SELECT id, status FROM borrow_requests WHERE id = $1 FOR UPDATE;`,
      [preHs.borrow_request_id]
    );

    // 3. Lock handover_session third
    const hsRes = await client.query(
      `SELECT hs.*, b.library_id, b.current_custodian_id
       FROM handover_sessions hs
       JOIN books b ON b.id = hs.book_id
       WHERE hs.id = $1
       FOR UPDATE;`,
      [sessionId]
    );

    const hs = hsRes.rows[0];

    if (hs.status !== 'PENDING') {
      const error = new Error(`Handover session is in ${hs.status} state and cannot be verified.`);
      error.statusCode = 400;
      throw error;
    }

    // Check expiry
    if (new Date(hs.expires_at) < new Date()) {
      await client.query(
        `UPDATE handover_sessions SET status = 'EXPIRED' WHERE id = $1;`,
        [sessionId]
      );
      await client.query(
        `UPDATE borrow_requests SET status = 'EXPIRED' WHERE id = $1;`,
        [hs.borrow_request_id]
      );
      // Advance queue (books & borrow_requests already locked)
      await advanceQueue(client, hs.book_id, hs.library_id);
      await client.query('COMMIT');

      const error = new Error('Handover session has expired.');
      error.statusCode = 400;
      throw error;
    }

    if (hs.attempts_left <= 0) {
      const error = new Error('No PIN attempts remaining. Handover has failed.');
      error.statusCode = 400;
      throw error;
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, hs.pin_hash);

    if (!isValid) {
      const newAttempts = hs.attempts_left - 1;
      await client.query(
        `UPDATE handover_sessions SET attempts_left = $1 WHERE id = $2;`,
        [newAttempts, sessionId]
      );

      if (newAttempts <= 0) {
        // PIN exhausted → FAIL handover and request
        await client.query(
          `UPDATE handover_sessions SET status = 'FAILED' WHERE id = $1;`,
          [sessionId]
        );
        await client.query(
          `UPDATE borrow_requests SET status = 'FAILED' WHERE id = $1;`,
          [hs.borrow_request_id]
        );
        // Advance queue (books & borrow_requests already locked)
        await advanceQueue(client, hs.book_id, hs.library_id);
        await client.query('COMMIT');

        const error = new Error('PIN verification failed. All attempts exhausted. Handover failed.');
        error.statusCode = 400;
        throw error;
      }

      await client.query('COMMIT');

      const error = new Error(`Incorrect PIN. ${newAttempts} attempt(s) remaining.`);
      error.statusCode = 400;
      throw error;
    }

    // PIN correct → mark VERIFIED
    await client.query(
      `UPDATE handover_sessions SET status = 'VERIFIED', verified_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [sessionId]
    );

    await client.query('COMMIT');

    broadcastHandoverStatus(hs.borrow_request_id, 'VERIFIED', {
      status: 'VERIFIED',
      handoverSessionId: sessionId,
    });

    return { verified: true, sessionId };
  } catch (err) {
    if (!client._ended) {
      try { await client.query('ROLLBACK'); } catch (_) { /* already committed or rolled back */ }
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── Condition Confirmation ──────────────────────────────

/**
 * Records a condition confirmation by giver or receiver.
 * Once BOTH have confirmed, performs the atomic custody transfer.
 */
async function confirmCondition(sessionId, userId, conditionRating, conditionNotes = '') {
  if (!VALID_CONDITIONS.includes(conditionRating)) {
    const error = new Error(`Condition must be one of: ${VALID_CONDITIONS.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 0. Initial non-locking snapshot check to find related IDs
    const hsCheck = await client.query(
      `SELECT hs.id, hs.borrow_request_id, hs.book_id, hs.giver_user_id, hs.receiver_user_id, hs.status
       FROM handover_sessions hs
       WHERE hs.id = $1;`,
      [sessionId]
    );

    if (hsCheck.rowCount === 0) {
      const error = new Error('Handover session not found.');
      error.statusCode = 404;
      throw error;
    }

    const preHs = hsCheck.rows[0];

    const isGiver = preHs.giver_user_id === userId;
    const isReceiver = preHs.receiver_user_id === userId;

    if (!isGiver && !isReceiver) {
      const error = new Error('You are not authorized to confirm condition for this handover.');
      error.statusCode = 403;
      throw error;
    }

    if (preHs.status !== 'VERIFIED') {
      const error = new Error('PIN must be verified before confirming condition.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Lock book first (canonical lock order: books → borrow_requests → handover_sessions)
    const bookRes = await client.query(
      `SELECT id, library_id, current_custodian_id FROM books WHERE id = $1 FOR UPDATE;`,
      [preHs.book_id]
    );
    const bookRow = bookRes.rows[0];

    // 2. Lock borrow_request second
    await client.query(
      `SELECT id, status FROM borrow_requests WHERE id = $1 FOR UPDATE;`,
      [preHs.borrow_request_id]
    );

    // 3. Lock handover_session third
    const hsRes = await client.query(
      `SELECT hs.*, b.library_id, b.current_custodian_id
       FROM handover_sessions hs
       JOIN books b ON b.id = hs.book_id
       WHERE hs.id = $1
       FOR UPDATE;`,
      [sessionId]
    );

    const hs = hsRes.rows[0];

    if (hs.status !== 'VERIFIED') {
      const error = new Error('PIN must be verified before confirming condition.');
      error.statusCode = 400;
      throw error;
    }

    // Prevent double-confirmation
    if (isGiver && hs.giver_confirmed_at) {
      const error = new Error('You have already confirmed the condition as the giver.');
      error.statusCode = 400;
      throw error;
    }
    if (isReceiver && hs.receiver_confirmed_at) {
      const error = new Error('You have already confirmed the condition as the receiver.');
      error.statusCode = 400;
      throw error;
    }

    // Record the confirmation
    if (isGiver) {
      await client.query(
        `UPDATE handover_sessions
         SET giver_condition_rating = $1, giver_condition_notes = $2, giver_confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $3;`,
        [conditionRating, conditionNotes || null, sessionId]
      );
    } else {
      await client.query(
        `UPDATE handover_sessions
         SET receiver_condition_rating = $1, receiver_condition_notes = $2, receiver_confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $3;`,
        [conditionRating, conditionNotes || null, sessionId]
      );
    }

    // Re-read to check if both sides confirmed
    const updatedHs = await client.query(
      `SELECT * FROM handover_sessions WHERE id = $1;`,
      [sessionId]
    );
    const updated = updatedHs.rows[0];

    const bothConfirmed = Boolean(updated.giver_confirmed_at && updated.receiver_confirmed_at);

    if (bothConfirmed) {
      // ── Atomic custody transfer ── (books already locked above)

      // Load library rules for due date
      const rulesRes = await client.query(
        `SELECT max_borrow_days FROM libraries WHERE id = $1;`,
        [bookRow.library_id]
      );
      const maxBorrowDays = rulesRes.rows[0].max_borrow_days;

      const now = new Date();
      const dueDate = new Date(now.getTime() + maxBorrowDays * 24 * 60 * 60 * 1000);

      // 1. Update borrow_request → ACTIVE with timestamps
      await client.query(
        `UPDATE borrow_requests
         SET status = 'ACTIVE', borrow_started_at = $1, due_date = $2
         WHERE id = $3;`,
        [now, dueDate, hs.borrow_request_id]
      );

      // 2. Update book: new custodian, status BORROWED
      await client.query(
        `UPDATE books SET current_custodian_id = $1, status = 'BORROWED' WHERE id = $2;`,
        [hs.receiver_user_id, hs.book_id]
      );

      // 3. Write custody_history
      await client.query(
        `INSERT INTO custody_history (
           book_id, handover_session_id, from_user_id, to_user_id,
           giver_condition_rating, receiver_condition_rating
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          hs.book_id,
          sessionId,
          hs.giver_user_id,
          hs.receiver_user_id,
          updated.giver_condition_rating,
          updated.receiver_condition_rating,
        ]
      );
    }

    await client.query('COMMIT');

    if (bothConfirmed) {
      broadcastHandoverStatus(hs.borrow_request_id, 'ACTIVE', {
        status: 'ACTIVE',
        newCustodianId: hs.receiver_user_id,
        bookId: hs.book_id,
      });
    }

    return {
      confirmed: true,
      role: isGiver ? 'giver' : 'receiver',
      conditionRating,
      transferCompleted: bothConfirmed,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Early Release ───────────────────────────────────────

/**
 * Current custodian initiates early release when a waiting member exists.
 * Completes the current ACTIVE borrow request and promotes the next queued member.
 */
async function initiateEarlyRelease(bookId, custodianUserId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock book
    const bookRes = await client.query(
      `SELECT id, library_id, current_custodian_id, status FROM books WHERE id = $1 FOR UPDATE;`,
      [bookId]
    );

    if (bookRes.rowCount === 0) {
      const error = new Error('Book not found.');
      error.statusCode = 404;
      throw error;
    }

    const book = bookRes.rows[0];

    if (book.current_custodian_id !== custodianUserId) {
      const error = new Error('Only the current custodian can initiate early release.');
      error.statusCode = 403;
      throw error;
    }

    // Check if there are waiting members
    const queueCheck = await client.query(
      `SELECT COUNT(*) AS cnt FROM borrow_requests
       WHERE book_id = $1 AND status = 'QUEUED';`,
      [bookId]
    );

    if (parseInt(queueCheck.rows[0].cnt, 10) === 0) {
      const error = new Error('No waiting members in the queue. Early release is not applicable.');
      error.statusCode = 400;
      throw error;
    }

    // Complete the current active borrow request (if any)
    await client.query(
      `UPDATE borrow_requests SET status = 'COMPLETED'
       WHERE book_id = $1 AND borrower_id = $2 AND status = 'ACTIVE';`,
      [bookId, custodianUserId]
    );

    // Advance queue (promotes next eligible member)
    const advancement = await advanceQueue(client, bookId, book.library_id);

    await client.query('COMMIT');

    return {
      message: 'Early release initiated.',
      queueAdvancement: advancement,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Expire Handover Sessions ────────────────────────────

/**
 * Expires overdue handover sessions. Called explicitly (e.g. from a cron or check endpoint).
 * Returns count of expired sessions.
 */
async function expireOverdueHandovers() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 0. Find expired PENDING handover sessions without row locks
    const expiredRes = await client.query(
      `SELECT hs.id, hs.borrow_request_id, hs.book_id, b.library_id
       FROM handover_sessions hs
       JOIN books b ON b.id = hs.book_id
       WHERE hs.status = 'PENDING' AND hs.expires_at < CURRENT_TIMESTAMP;`
    );

    let expiredCount = 0;

    for (const hs of expiredRes.rows) {
      // 1. Lock book first (canonical lock order: books → borrow_requests → handover_sessions)
      await client.query(
        `SELECT id FROM books WHERE id = $1 FOR UPDATE;`,
        [hs.book_id]
      );

      // 2. Lock borrow_request second
      await client.query(
        `SELECT id FROM borrow_requests WHERE id = $1 FOR UPDATE;`,
        [hs.borrow_request_id]
      );

      // 3. Lock handover_session third
      const hsLock = await client.query(
        `SELECT id, status FROM handover_sessions WHERE id = $1 FOR UPDATE;`,
        [hs.id]
      );

      if (hsLock.rows[0]?.status === 'PENDING') {
        // Expire handover session
        await client.query(
          `UPDATE handover_sessions SET status = 'EXPIRED' WHERE id = $1;`,
          [hs.id]
        );

        // Expire borrow request
        await client.query(
          `UPDATE borrow_requests SET status = 'EXPIRED' WHERE id = $1;`,
          [hs.borrow_request_id]
        );

        // Advance queue (books & borrow_requests already locked)
        await advanceQueue(client, hs.book_id, hs.library_id);
        expiredCount++;
      }
    }

    await client.query('COMMIT');
    return { expiredCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── List Borrow Requests for a Book ─────────────────────

/**
 * Lists borrow requests for a book (accessible to approved members).
 */
async function listRequestsForBook(bookId, userId) {
  // Verify user is an approved member of the book's library
  const bookRes = await db.query(
    `SELECT b.library_id FROM books b WHERE b.id = $1;`,
    [bookId]
  );

  if (bookRes.rowCount === 0) {
    const error = new Error('Book not found.');
    error.statusCode = 404;
    throw error;
  }

  const libraryId = bookRes.rows[0].library_id;

  const memRes = await db.query(
    `SELECT id FROM library_members
     WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED';`,
    [libraryId, userId]
  );

  if (memRes.rowCount === 0) {
    const error = new Error('You must be an approved member to view borrow requests.');
    error.statusCode = 403;
    throw error;
  }

  const res = await db.query(
    `SELECT br.id, br.borrower_id, br.status, br.created_at, br.borrow_started_at, br.due_date,
            u.full_name AS borrower_name
     FROM borrow_requests br
     JOIN users u ON u.id = br.borrower_id
     WHERE br.book_id = $1
     ORDER BY br.created_at DESC;`,
    [bookId]
  );

  return res.rows;
}

// ─── List My Requests & Custody ───────────────────────────

/**
 * Returns all requests and physical custody books for the user.
 */
async function getMyRequests(userId) {
  const asBorrower = await db.query(
    `SELECT br.*, b.title AS book_title, b.author AS book_author, b.library_id,
            b.current_custodian_id, b.status AS book_status,
            l.name AS library_name,
            hs.id AS handover_session_id, hs.status AS handover_status
     FROM borrow_requests br
     JOIN books b ON b.id = br.book_id
     JOIN libraries l ON l.id = b.library_id
     LEFT JOIN handover_sessions hs ON hs.borrow_request_id = br.id AND hs.status = 'PENDING'
     WHERE br.borrower_id = $1
     ORDER BY br.created_at DESC;`,
    [userId]
  );

  const asCustodian = await db.query(
    `SELECT br.*, b.title AS book_title, b.author AS book_author, b.library_id,
            b.current_custodian_id, b.status AS book_status,
            l.name AS library_name,
            u.full_name AS borrower_name,
            hs.id AS handover_session_id, hs.status AS handover_status
     FROM borrow_requests br
     JOIN books b ON b.id = br.book_id
     JOIN libraries l ON l.id = b.library_id
     JOIN users u ON u.id = br.borrower_id
     LEFT JOIN handover_sessions hs ON hs.borrow_request_id = br.id AND hs.status = 'PENDING'
     WHERE b.current_custodian_id = $1
       AND br.status IN ('CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE')
     ORDER BY br.created_at DESC;`,
    [userId]
  );

  const inCustody = await db.query(
    `SELECT b.*, l.name AS library_name
     FROM books b
     JOIN libraries l ON l.id = b.library_id
     WHERE b.current_custodian_id = $1
       AND b.status != 'REMOVED'
     ORDER BY b.title ASC;`,
    [userId]
  );

  return {
    asBorrower: asBorrower.rows,
    asCustodian: asCustodian.rows,
    inCustody: inCustody.rows,
  };
}

module.exports = {
  createBorrowRequest,
  getBorrowRequest,
  approveBorrowRequest,
  declineBorrowRequest,
  cancelBorrowRequest,
  getHandoverSession,
  verifyPin,
  confirmCondition,
  initiateEarlyRelease,
  expireOverdueHandovers,
  listRequestsForBook,
  getMyRequests,
  advanceQueue,
};
