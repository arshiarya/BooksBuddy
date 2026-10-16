const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const borrowingService = require('../src/modules/borrowing/borrowing.service');

describe('Concurrency, Security & Integrity Hardening Test Suite (Phase 10)', () => {
  let librarianCookie, librarianCsrf, librarianId;
  let user1Cookie, user1Csrf, user1Id;
  let user2Cookie, user2Csrf, user2Id;
  let user3Cookie, user3Csrf, user3Id;
  let user4Cookie, user4Csrf, user4Id;

  let libraryId;
  const ts = Date.now();

  async function registerUser(nameSuffix, emailPrefix) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Bypass-Rate-Limit', '1')
      .send({
        email: `${emailPrefix}_${ts}_${Math.random().toString(36).slice(2, 7)}@example.com`,
        password: 'Password123!',
        full_name: `User ${nameSuffix}`,
        phone: `+9198765${String(Math.floor(10000 + Math.random() * 90000))}`,
        society_locality: 'Hardening Test Society',
        flat_house_number: `Flat-${nameSuffix}`,
        city: 'ConcurrencyCity',
      });

    assert.equal(res.status, 201, `Failed to register ${nameSuffix}: ${JSON.stringify(res.body)}`);
    return {
      cookie: res.headers['set-cookie'].find((c) => c.startsWith('booksbuddy_sid=')).split(';')[0],
      csrf: res.body.csrfToken,
      id: res.body.user.id,
    };
  }

  async function approveMember(userId, cookie, csrf) {
    const joinRes = await request(app)
      .post(`/api/v1/libraries/${libraryId}/join`)
      .set('Cookie', [cookie])
      .set('X-CSRF-Token', csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    assert.equal(joinRes.status, 201, `Failed to join library: ${JSON.stringify(joinRes.body)}`);
    const membershipId = joinRes.body.membership.id;

    const approveRes = await request(app)
      .put(`/api/v1/libraries/${libraryId}/members/${membershipId}`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ status: 'APPROVED' });

    assert.equal(approveRes.status, 200, `Failed to approve member: ${JSON.stringify(approveRes.body)}`);
  }

  async function donateBook(title) {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({
        library_id: libraryId,
        title,
        author: 'Concurrency Author',
        genre: 'Technology',
        initial_condition: 'GOOD',
      });

    assert.equal(res.status, 201, `Failed to donate book: ${JSON.stringify(res.body)}`);
    return res.body.book.id;
  }

  before(async () => {
    // 1. Create primary librarian (use 'cc_' prefix so libraries.test.js doesn't delete it)
    const libUser = await registerUser('PrimaryLib', 'cc_librarian');
    librarianCookie = libUser.cookie;
    librarianCsrf = libUser.csrf;
    librarianId = libUser.id;

    // 2. Create test library with high max_books_per_member so tests don't hit member limits
    const libRes = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({
        name: `Concurrency Hardening Library ${ts}`,
        society_locality: 'Hardening Test Society',
        city: 'ConcurrencyCity',
        max_borrow_days: 14,
        handover_window_hours: 48,
        max_books_per_member: 50,
        max_renewals: 1,
      });

    assert.equal(libRes.status, 201, `Failed to create library: ${JSON.stringify(libRes.body)}`);
    libraryId = libRes.body.library.id;

    // 3. Register test members
    const u1 = await registerUser('One', 'cc_user1');
    user1Cookie = u1.cookie;
    user1Csrf = u1.csrf;
    user1Id = u1.id;

    const u2 = await registerUser('Two', 'cc_user2');
    user2Cookie = u2.cookie;
    user2Csrf = u2.csrf;
    user2Id = u2.id;

    const u3 = await registerUser('Three', 'cc_user3');
    user3Cookie = u3.cookie;
    user3Csrf = u3.csrf;
    user3Id = u3.id;

    const u4 = await registerUser('Four', 'cc_user4');
    user4Cookie = u4.cookie;
    user4Csrf = u4.csrf;
    user4Id = u4.id;

    // 4. Approve members into the library
    await approveMember(user1Id, user1Cookie, user1Csrf);
    await approveMember(user2Id, user2Cookie, user2Csrf);
    await approveMember(user3Id, user3Cookie, user3Csrf);
    await approveMember(user4Id, user4Cookie, user4Csrf);
  });

  after(async () => {
    // Clean up concurrency test library and dependent records in reverse dependency order
    if (libraryId) {
      await db.query('DELETE FROM custody_history WHERE book_id IN (SELECT id FROM books WHERE library_id = $1);', [libraryId]).catch(() => {});
      await db.query('DELETE FROM handover_sessions WHERE book_id IN (SELECT id FROM books WHERE library_id = $1);', [libraryId]).catch(() => {});
      await db.query('DELETE FROM borrow_requests WHERE book_id IN (SELECT id FROM books WHERE library_id = $1);', [libraryId]).catch(() => {});
      await db.query('DELETE FROM books WHERE library_id = $1;', [libraryId]).catch(() => {});
      await db.query('DELETE FROM library_members WHERE library_id = $1;', [libraryId]).catch(() => {});
      await db.query('DELETE FROM libraries WHERE id = $1;', [libraryId]).catch(() => {});
    }
  });

  // ── Scenario 1 ───────────────────────────────────────────────────────────
  test('Scenario 1: Two users requesting the same available book simultaneously', async () => {
    const bookId = await donateBook('Concurrency Book 1 - Simultaneous Borrow');

    // Both User 1 and User 2 request the available book in parallel
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/borrowing/requests')
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ book_id: bookId }),
      request(app)
        .post('/api/v1/borrowing/requests')
        .set('Cookie', [user2Cookie])
        .set('X-CSRF-Token', user2Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ book_id: bookId }),
    ]);

    // One must receive CUSTODIAN_APPROVAL_PENDING and the other enters QUEUED
    const statuses = [res1.body.request?.status, res2.body.request?.status].filter(Boolean);
    assert.ok(
      statuses.includes('CUSTODIAN_APPROVAL_PENDING'),
      'Exactly one request must be in CUSTODIAN_APPROVAL_PENDING'
    );
    assert.ok(
      statuses.includes('QUEUED'),
      'The other request must transition to QUEUED'
    );

    // Database invariant: exactly ONE active/pending borrow request exists
    const dbCheck = await db.query(
      `SELECT COUNT(*) AS active_count
       FROM borrow_requests
       WHERE book_id = $1
         AND status IN ('CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE');`,
      [bookId]
    );
    assert.equal(parseInt(dbCheck.rows[0].active_count, 10), 1, 'Database must have exactly 1 active/pending request');

    // Book status in database must be RESERVED
    const bookCheck = await db.query('SELECT status FROM books WHERE id = $1;', [bookId]);
    assert.equal(bookCheck.rows[0].status, 'RESERVED');
  });

  // ── Scenario 2 ───────────────────────────────────────────────────────────
  test('Scenario 2: Multiple users joining the same FIFO queue simultaneously', async () => {
    const bookId = await donateBook('Concurrency Book 2 - FIFO Queue');

    // Put book in RESERVED by initial request
    await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    // Users 2, 3, and 4 join queue simultaneously
    const results = await Promise.all([
      request(app)
        .post('/api/v1/borrowing/requests')
        .set('Cookie', [user2Cookie])
        .set('X-CSRF-Token', user2Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ book_id: bookId }),
      request(app)
        .post('/api/v1/borrowing/requests')
        .set('Cookie', [user3Cookie])
        .set('X-CSRF-Token', user3Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ book_id: bookId }),
      request(app)
        .post('/api/v1/borrowing/requests')
        .set('Cookie', [user4Cookie])
        .set('X-CSRF-Token', user4Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ book_id: bookId }),
    ]);

    for (const res of results) {
      assert.equal(res.status, 201);
      assert.equal(res.body.request.status, 'QUEUED');
      assert.ok(res.body.queue_position >= 1);
    }

    // Invariant: Exactly 3 QUEUED requests in database, with distinct positions
    const queueCheck = await db.query(
      `SELECT id, borrower_id, created_at
       FROM borrow_requests
       WHERE book_id = $1 AND status = 'QUEUED'
       ORDER BY created_at ASC, id ASC;`,
      [bookId]
    );
    assert.equal(queueCheck.rowCount, 3, 'Must have exactly 3 queued records');
    const borrowerIds = new Set(queueCheck.rows.map((r) => Number(r.borrower_id)));
    assert.equal(borrowerIds.size, 3, 'All 3 queued requests must belong to distinct members');
  });

  // ── Scenario 3 ───────────────────────────────────────────────────────────
  test('Scenario 3: Two users attempting to become the next handover candidate simultaneously', async () => {
    const bookId = await donateBook('Concurrency Book 3 - Handover Candidate Race');

    // User 1 requests book (direct)
    const req1 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    // User 2 and User 3 queue
    await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user2Cookie])
      .set('X-CSRF-Token', user2Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user3Cookie])
      .set('X-CSRF-Token', user3Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    // Custodian declines request 1, advancing queue
    const declineRes = await request(app)
      .post(`/api/v1/borrowing/requests/${req1.body.request.id}/decline`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    assert.equal(declineRes.status, 200);

    // Invariant: exactly ONE user is promoted to HANDOVER_PENDING
    const promotedRes = await db.query(
      `SELECT id, borrower_id, status FROM borrow_requests
       WHERE book_id = $1 AND status = 'HANDOVER_PENDING';`,
      [bookId]
    );
    assert.equal(promotedRes.rowCount, 1, 'Exactly one queued candidate must be promoted');
    assert.equal(Number(promotedRes.rows[0].borrower_id), Number(user2Id), 'Earliest queued member (User 2) must be promoted');

    // Invariant: exactly ONE pending handover session exists
    const hsCheck = await db.query(
      `SELECT id, receiver_user_id, status FROM handover_sessions
       WHERE book_id = $1 AND status = 'PENDING';`,
      [bookId]
    );
    assert.equal(hsCheck.rowCount, 1, 'Exactly one pending handover session must exist in DB');
    assert.equal(Number(hsCheck.rows[0].receiver_user_id), Number(user2Id));
  });

  // ── Scenario 4 ───────────────────────────────────────────────────────────
  test('Scenario 4: Approve vs Cancel race', async () => {
    const bookId = await donateBook('Concurrency Book 4 - Approve vs Cancel Race');

    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    const requestId = reqRes.body.request.id;

    // Concurrently: Custodian approves vs Borrower cancels
    const [approveRes, cancelRes] = await Promise.all([
      request(app)
        .post(`/api/v1/borrowing/requests/${requestId}/approve`)
        .set('Cookie', [librarianCookie])
        .set('X-CSRF-Token', librarianCsrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send(),
      request(app)
        .post(`/api/v1/borrowing/requests/${requestId}/cancel`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send(),
    ]);

    // Both operations must resolve safely with valid status codes (no 500, no deadlock)
    assert.ok([200, 400].includes(approveRes.status), 'Approve must return 200 or 400');
    assert.ok([200, 400].includes(cancelRes.status), 'Cancel must return 200 or 400');
    assert.ok(approveRes.status === 200 || cancelRes.status === 200, 'At least one operation must succeed');

    // Database state must be clean and terminal/pending
    const finalReq = await db.query('SELECT status FROM borrow_requests WHERE id = $1;', [requestId]);
    assert.ok(
      ['HANDOVER_PENDING', 'CANCELLED'].includes(finalReq.rows[0].status),
      'Request status must be either HANDOVER_PENDING or CANCELLED'
    );
  });

  // ── Scenario 5 ───────────────────────────────────────────────────────────
  test('Scenario 5: Expiry vs Approval race', async () => {
    const bookId = await donateBook('Concurrency Book 5 - Expiry vs Approval Race');

    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    const requestId = reqRes.body.request.id;

    // Approve initial request to create a handover session
    const appRes = await request(app)
      .post(`/api/v1/borrowing/requests/${requestId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    const sessionId = appRes.body.handoverSession.id;

    // Artificially set handover session to expired in DB
    await db.query(
      `UPDATE handover_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = $1;`,
      [sessionId]
    );

    // Concurrently: background expiration worker runs vs borrower attempts to verify PIN
    await Promise.all([
      borrowingService.expireOverdueHandovers(),
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ pin: '1234' }),
    ]);

    // Final state of handover session must be terminal EXPIRED (never double-allocated)
    const hsFinal = await db.query('SELECT status FROM handover_sessions WHERE id = $1;', [sessionId]);
    assert.equal(hsFinal.rows[0].status, 'EXPIRED', 'Handover session must be marked EXPIRED');

    // Borrow request must also be EXPIRED
    const brFinal = await db.query('SELECT status FROM borrow_requests WHERE id = $1;', [requestId]);
    assert.equal(brFinal.rows[0].status, 'EXPIRED', 'Borrow request must be marked EXPIRED');
  });

  // ── Scenario 6 ───────────────────────────────────────────────────────────
  test('Scenario 6: Two concurrent PIN verification attempts', async () => {
    const bookId = await donateBook('Concurrency Book 6 - Concurrent PIN Verification');

    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    const requestId = reqRes.body.request.id;

    const appRes = await request(app)
      .post(`/api/v1/borrowing/requests/${requestId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    const sessionId = appRes.body.handoverSession.id;
    const correctPin = appRes.body.handoverSession.pin;

    // Case 1: Two parallel WRONG PIN verification attempts
    const [wrong1, wrong2] = await Promise.all([
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ pin: '0000' }),
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ pin: '1111' }),
    ]);

    assert.equal(wrong1.status, 400);
    assert.equal(wrong2.status, 400);

    // Invariant: attempts_left was 3, after 2 atomic decrements it must be EXACTLY 1 (no lost updates)
    const checkAttempts = await db.query('SELECT attempts_left, status FROM handover_sessions WHERE id = $1;', [sessionId]);
    assert.equal(checkAttempts.rows[0].attempts_left, 1, 'attempts_left must decrement atomically to 1');
    assert.equal(checkAttempts.rows[0].status, 'PENDING');

    // Case 2: Parallel correct PIN and wrong PIN attempt
    const [correctAttempt, wrongAttempt] = await Promise.all([
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ pin: correctPin }),
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ pin: '9999' }),
    ]);

    // Exactly one should succeed with 200 VERIFIED
    const isOneSuccess = (correctAttempt.status === 200 || wrongAttempt.status === 200);
    assert.ok(isOneSuccess, 'One attempt must succeed');

    const finalHs = await db.query('SELECT status, verified_at FROM handover_sessions WHERE id = $1;', [sessionId]);
    assert.equal(finalHs.rows[0].status, 'VERIFIED');
    assert.ok(finalHs.rows[0].verified_at !== null);
  });

  // ── Scenario 7 ───────────────────────────────────────────────────────────
  test('Scenario 7: Two concurrent condition confirmations (Giver & Receiver)', async () => {
    const bookId = await donateBook('Concurrency Book 7 - Condition Confirmation Race');

    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    const requestId = reqRes.body.request.id;

    const appRes = await request(app)
      .post(`/api/v1/borrowing/requests/${requestId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    const sessionId = appRes.body.handoverSession.id;
    const pin = appRes.body.handoverSession.pin;

    // Verify PIN first
    const pinRes = await request(app)
      .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ pin });

    assert.equal(pinRes.status, 200);

    // Giver (Librarian) and Receiver (User 1) confirm conditions simultaneously
    const [giverRes, receiverRes] = await Promise.all([
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`)
        .set('Cookie', [librarianCookie])
        .set('X-CSRF-Token', librarianCsrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ condition_rating: 'GOOD', condition_notes: 'Clean book' }),
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ condition_rating: 'GOOD', condition_notes: 'Received in good state' }),
    ]);

    assert.equal(giverRes.status, 200);
    assert.equal(receiverRes.status, 200);

    // Invariants:
    // 1. Custody transferred atomically to User 1
    const bookRow = await db.query('SELECT current_custodian_id, status FROM books WHERE id = $1;', [bookId]);
    assert.equal(Number(bookRow.rows[0].current_custodian_id), Number(user1Id), 'Current custodian must be User 1');
    assert.equal(bookRow.rows[0].status, 'BORROWED');

    // 2. Borrow request status is ACTIVE
    const reqRow = await db.query('SELECT status, borrow_started_at, due_date FROM borrow_requests WHERE id = $1;', [requestId]);
    assert.equal(reqRow.rows[0].status, 'ACTIVE');
    assert.ok(reqRow.rows[0].borrow_started_at !== null);

    // 3. Exactly ONE custody_history record created for this handover session (no duplicate history!)
    const historyCheck = await db.query(
      `SELECT COUNT(*) AS cnt FROM custody_history WHERE handover_session_id = $1;`,
      [sessionId]
    );
    assert.equal(parseInt(historyCheck.rows[0].cnt, 10), 1, 'Exactly 1 custody history entry must be created');
  });

  // ── Scenario 8 ───────────────────────────────────────────────────────────
  test('Scenario 8: Two concurrent handover completion attempts (Double confirm by same role)', async () => {
    const bookId = await donateBook('Concurrency Book 8 - Double Confirm by Same Role');

    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    const requestId = reqRes.body.request.id;

    const appRes = await request(app)
      .post(`/api/v1/borrowing/requests/${requestId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    const sessionId = appRes.body.handoverSession.id;
    const pin = appRes.body.handoverSession.pin;

    await request(app)
      .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ pin });

    // Giver sends two duplicate condition confirmation requests simultaneously
    const [call1, call2] = await Promise.all([
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`)
        .set('Cookie', [librarianCookie])
        .set('X-CSRF-Token', librarianCsrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ condition_rating: 'GOOD' }),
      request(app)
        .post(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`)
        .set('Cookie', [librarianCookie])
        .set('X-CSRF-Token', librarianCsrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send({ condition_rating: 'GOOD' }),
    ]);

    // Exactly one must succeed (200) and the other rejected with 400
    const statuses = [call1.status, call2.status].sort();
    assert.deepEqual(statuses, [200, 400], 'One confirmation must succeed, the other rejected with 400');
  });

  // ── Scenario 9 ───────────────────────────────────────────────────────────
  test('Scenario 9: Concurrent early-release attempts', async () => {
    const bookId = await donateBook('Concurrency Book 9 - Concurrent Early Release');

    // 1. User 1 borrows and activates book
    const req1 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    assert.equal(req1.status, 201, `Failed to create req1: ${JSON.stringify(req1.body)}`);

    const appRes = await request(app)
      .post(`/api/v1/borrowing/requests/${req1.body.request.id}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send();

    const sessionId = appRes.body.handoverSession.id;
    const pin = appRes.body.handoverSession.pin;

    await request(app)
      .post(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`)
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ pin });

    await request(app)
      .post(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ condition_rating: 'GOOD' });

    await request(app)
      .post(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`)
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ condition_rating: 'GOOD' });

    // 2. User 2 queues for the book
    await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user2Cookie])
      .set('X-CSRF-Token', user2Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    // 3. User 1 (current custodian) fires two early-release requests simultaneously
    const [rel1, rel2] = await Promise.all([
      request(app)
        .post(`/api/v1/borrowing/books/${bookId}/early-release`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send(),
      request(app)
        .post(`/api/v1/borrowing/books/${bookId}/early-release`)
        .set('Cookie', [user1Cookie])
        .set('X-CSRF-Token', user1Csrf)
        .set('X-Bypass-Rate-Limit', '1')
        .send(),
    ]);

    // Exactly one early-release succeeds; the other is rejected
    const statuses = [rel1.status, rel2.status].sort();
    assert.deepEqual(statuses, [200, 400], 'One early release succeeds, the second is rejected');

    // Invariant: Exactly ONE user promoted to HANDOVER_PENDING
    const promotedCheck = await db.query(
      `SELECT id, borrower_id, status FROM borrow_requests WHERE book_id = $1 AND status = 'HANDOVER_PENDING';`,
      [bookId]
    );
    assert.equal(promotedCheck.rowCount, 1, 'Exactly one candidate promoted by early release');
    assert.equal(Number(promotedCheck.rows[0].borrower_id), Number(user2Id));
  });

  // ── Scenario 10 ──────────────────────────────────────────────────────────
  test('Scenario 10: Concurrent queue advancement serialization', async () => {
    const bookId = await donateBook('Concurrency Book 10 - Queue Advancement Serialization');

    // User 1 requests and queues User 2, User 3
    const req1 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user1Cookie])
      .set('X-CSRF-Token', user1Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    assert.equal(req1.status, 201, `Failed to create req1: ${JSON.stringify(req1.body)}`);

    await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user2Cookie])
      .set('X-CSRF-Token', user2Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [user3Cookie])
      .set('X-CSRF-Token', user3Csrf)
      .set('X-Bypass-Rate-Limit', '1')
      .send({ book_id: bookId });

    // Invalidate request 1 directly to trigger advancement simultaneously from two parallel DB clients
    await db.query(`UPDATE borrow_requests SET status = 'DECLINED' WHERE id = $1;`, [req1.body.request.id]);

    const clientA = await db.getClient();
    const clientB = await db.getClient();

    try {
      // Both clients execute advanceQueue concurrently on the same book
      const [resA, resB] = await Promise.all([
        (async () => {
          await clientA.query('BEGIN');
          await clientA.query('SELECT id FROM books WHERE id = $1 FOR UPDATE;', [bookId]);
          const result = await borrowingService.advanceQueue(clientA, bookId, libraryId);
          await clientA.query('COMMIT');
          return result;
        })(),
        (async () => {
          await clientB.query('BEGIN');
          await clientB.query('SELECT id FROM books WHERE id = $1 FOR UPDATE;', [bookId]);
          const result = await borrowingService.advanceQueue(clientB, bookId, libraryId);
          await clientB.query('COMMIT');
          return result;
        })(),
      ]);

      // Exactly ONE transaction must have promoted a candidate; the other must return { promoted: false }
      const promotions = [resA.promoted, resB.promoted];
      assert.ok(
        promotions.includes(true) && promotions.includes(false),
        'Row-level locking must ensure only one concurrent queue advancement promotes a candidate'
      );

      // Verify database invariant: exactly ONE HANDOVER_PENDING request exists
      const hpCheck = await db.query(
        `SELECT id, borrower_id FROM borrow_requests WHERE book_id = $1 AND status = 'HANDOVER_PENDING';`,
        [bookId]
      );
      assert.equal(hpCheck.rowCount, 1, 'Exactly one request in HANDOVER_PENDING in database');
      assert.equal(Number(hpCheck.rows[0].borrower_id), Number(user2Id), 'Earliest queued member promoted');
    } finally {
      clientA.release();
      clientB.release();
    }
  });
});
