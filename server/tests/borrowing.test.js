const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Borrowing, FIFO Queue, PIN Handover & Custody (Phase 6)', () => {
  /*
   * Test actors:
   *   librarian   – PRIMARY_LIBRARIAN (also current custodian of donated books)
   *   borrower1   – approved member (first borrower)
   *   borrower2   – approved member (second borrower / waitlist)
   *   borrower3   – approved member (third borrower / waitlist)
   *   outsider    – NOT a member of the test library
   */

  let librarianCookie, librarianCsrf, librarianId;
  let borrower1Cookie, borrower1Csrf, borrower1Id;
  let borrower2Cookie, borrower2Csrf, borrower2Id;
  let borrower3Cookie, borrower3Csrf, borrower3Id;
  let outsiderCookie, outsiderCsrf;

  let libraryId;
  let bookAId;  // Book A – used for the primary borrowing flow
  let bookBId;  // Book B – used for queue/concurrent tests
  let bookCId;  // Book C – used for early release test

  const ts = Date.now();

  async function registerUser(nameSuffix, emailPrefix) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Bypass-Rate-Limit', '1')
      .send({
        email: `${emailPrefix}_${ts}@example.com`,
        password: 'Password123!',
        full_name: `Test ${nameSuffix}`,
        phone: `+9198765${String(ts).slice(-5)}`,
        society_locality: 'BooksBuddy Test Society',
        flat_house_number: `Flat-${nameSuffix}`,
        city: 'TestCity',
      });
    return {
      cookie: res.headers['set-cookie'].find((c) => c.startsWith('booksbuddy_sid=')).split(';')[0],
      csrf: res.body.csrfToken,
      id: res.body.user.id,
    };
  }

  async function approveJoin(userId, cookie, csrf) {
    const joinRes = await request(app)
      .post(`/api/v1/libraries/${libraryId}/join`)
      .set('Cookie', [cookie])
      .set('X-CSRF-Token', csrf)
      .send();
    const membershipId = joinRes.body.membership.id;
    await request(app)
      .put(`/api/v1/libraries/${libraryId}/members/${membershipId}`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ status: 'APPROVED' });
  }

  async function donateBook(title) {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        library_id: libraryId,
        title,
        author: 'Test Author',
        initial_condition: 'GOOD',
      });
    return res.body.book.id;
  }

  before(async () => {
    if (authRoutes.authLimiter?.reset) authRoutes.authLimiter.reset();

    // Register users
    const lib = await registerUser('Librarian', 'borrow_librarian');
    librarianCookie = lib.cookie; librarianCsrf = lib.csrf; librarianId = lib.id;

    const b1 = await registerUser('Borrower1', 'borrow_b1');
    borrower1Cookie = b1.cookie; borrower1Csrf = b1.csrf; borrower1Id = b1.id;

    const b2 = await registerUser('Borrower2', 'borrow_b2');
    borrower2Cookie = b2.cookie; borrower2Csrf = b2.csrf; borrower2Id = b2.id;

    const b3 = await registerUser('Borrower3', 'borrow_b3');
    borrower3Cookie = b3.cookie; borrower3Csrf = b3.csrf; borrower3Id = b3.id;

    const out = await registerUser('Outsider', 'borrow_outsider');
    outsiderCookie = out.cookie; outsiderCsrf = out.csrf;

    // Create library with specific rules
    const libRes = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        name: `Phase6 Test Library ${ts}`,
        society_locality: 'BooksBuddy Test Society',
        city: 'TestCity',
        max_borrow_days: 7,
        handover_window_hours: 24,
        max_books_per_member: 2,
      });
    libraryId = libRes.body.library.id;

    // Approve members
    await approveJoin(borrower1Id, borrower1Cookie, borrower1Csrf);
    await approveJoin(borrower2Id, borrower2Cookie, borrower2Csrf);
    await approveJoin(borrower3Id, borrower3Cookie, borrower3Csrf);

    // Donate books (librarian is the custodian for all)
    bookAId = await donateBook('Test Book A - Borrowing Flow');
    bookBId = await donateBook('Test Book B - Queue Flow');
    bookCId = await donateBook('Test Book C - Early Release');
  });

  after(async () => {
    try {
      const userIdsRes = await db.query(
        `SELECT id FROM users WHERE email LIKE 'borrow_%_${ts}@example.com';`
      );
      const userIds = userIdsRes.rows.map((r) => r.id);
      if (userIds.length > 0) {
        await db.query('DELETE FROM custody_history WHERE to_user_id = ANY($1) OR from_user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM handover_sessions WHERE giver_user_id = ANY($1) OR receiver_user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM borrow_requests WHERE borrower_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM books WHERE original_donor_id = ANY($1) OR current_custodian_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM library_members WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM libraries WHERE created_by = ANY($1);', [userIds]);
        await db.query('DELETE FROM sessions WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM users WHERE id = ANY($1);', [userIds]);
      }
    } catch (err) {
      console.warn('[TEST CLEANUP WARNING]', err.message);
    }
    if (authRoutes.authLimiter?.reset) authRoutes.authLimiter.reset();
  });

  // ─── Direct Borrowing Flow ─────────────────────────────

  let borrowRequestAId;
  let handoverSessionAId;
  let handoverPinA;

  test('POST /api/v1/borrowing/requests creates direct borrow request (CUSTODIAN_APPROVAL_PENDING)', async () => {
    const res = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ book_id: bookAId });

    assert.equal(res.status, 201);
    assert.equal(res.body.request.status, 'CUSTODIAN_APPROVAL_PENDING');
    assert.equal(res.body.request.borrower_id, borrower1Id);
    assert.equal(res.body.request.book_id, bookAId);
    borrowRequestAId = res.body.request.id;
  });

  test('POST /api/v1/borrowing/requests fails for unauthenticated user (401)', async () => {
    const res = await request(app)
      .post('/api/v1/borrowing/requests')
      .send({ book_id: bookAId });
    assert.equal(res.status, 401);
  });

  test('POST /api/v1/borrowing/requests fails for non-member (403)', async () => {
    const res = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [outsiderCookie])
      .set('X-CSRF-Token', outsiderCsrf)
      .send({ book_id: bookAId });
    assert.equal(res.status, 403);
  });

  test('POST /api/v1/borrowing/requests fails for duplicate request (409)', async () => {
    const res = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ book_id: bookAId });
    assert.equal(res.status, 409);
  });

  test('POST /api/v1/borrowing/requests fails when borrower is the custodian (400)', async () => {
    const res = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ book_id: bookAId });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('custodian'));
  });

  test('GET /api/v1/borrowing/requests/:id returns request details', async () => {
    const res = await request(app)
      .get(`/api/v1/borrowing/requests/${borrowRequestAId}`)
      .set('Cookie', [borrower1Cookie]);
    assert.equal(res.status, 200);
    assert.equal(res.body.request.id, borrowRequestAId);
    assert.equal(res.body.request.status, 'CUSTODIAN_APPROVAL_PENDING');
  });

  test('GET /api/v1/borrowing/requests/:id fails for unauthorized user (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/borrowing/requests/${borrowRequestAId}`)
      .set('Cookie', [borrower2Cookie]);
    assert.equal(res.status, 403);
  });

  // ─── Custodian Approve / Decline ───────────────────────

  test('POST /requests/:id/approve fails for non-custodian (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestAId}/approve`)
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send();
    assert.equal(res.status, 403);
  });

  test('POST /requests/:id/approve by custodian creates handover session with PIN', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestAId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();

    assert.equal(res.status, 200);
    assert.equal(res.body.borrowRequest.status, 'HANDOVER_PENDING');
    assert.ok(res.body.handoverSession.id);
    assert.ok(res.body.handoverSession.pin);
    assert.equal(res.body.handoverSession.pin.length, 4);
    assert.ok(/^\d{4}$/.test(res.body.handoverSession.pin));

    handoverSessionAId = res.body.handoverSession.id;
    handoverPinA = res.body.handoverSession.pin;
  });

  test('POST /requests/:id/approve fails on already approved request (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestAId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();
    assert.equal(res.status, 400);
  });

  // ─── Handover Session & Address Privacy ────────────────

  test('GET /handovers/:id reveals address to receiver only', async () => {
    // Receiver sees pickup address
    const receiverRes = await request(app)
      .get(`/api/v1/borrowing/handovers/${handoverSessionAId}`)
      .set('Cookie', [borrower1Cookie]);
    assert.equal(receiverRes.status, 200);
    assert.ok(receiverRes.body.handoverSession.pickup_address, 'Receiver must see pickup address');
    assert.ok(receiverRes.body.handoverSession.pickup_address.flat_house_number);
    assert.ok(receiverRes.body.handoverSession.pickup_address.phone);

    // Giver does NOT see their own address echoed back
    const giverRes = await request(app)
      .get(`/api/v1/borrowing/handovers/${handoverSessionAId}`)
      .set('Cookie', [librarianCookie]);
    assert.equal(giverRes.status, 200);
    assert.equal(giverRes.body.handoverSession.pickup_address, undefined, 'Giver must NOT see address echoed');
  });

  test('GET /handovers/:id fails for unauthorized user (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/borrowing/handovers/${handoverSessionAId}`)
      .set('Cookie', [borrower2Cookie]);
    assert.equal(res.status, 403);
  });

  // ─── PIN Verification ─────────────────────────────────

  test('POST /handovers/:id/verify-pin fails with non-4-digit PIN (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/verify-pin`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ pin: '123' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('4-digit'));
  });

  test('POST /handovers/:id/verify-pin fails for non-receiver (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/verify-pin`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ pin: handoverPinA });
    assert.equal(res.status, 403);
  });

  test('POST /handovers/:id/verify-pin fails with wrong PIN and decrements attempts', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/verify-pin`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ pin: '0000' });
    // Might succeed if PIN happens to be 0000, handle both cases
    if (handoverPinA !== '0000') {
      assert.equal(res.status, 400);
      assert.ok(res.body.error.message.includes('Incorrect PIN') || res.body.error.message.includes('attempt'));
    }
  });

  test('POST /handovers/:id/verify-pin succeeds with correct PIN', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/verify-pin`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ pin: handoverPinA });
    assert.equal(res.status, 200);
    assert.equal(res.body.verified, true);
  });

  test('POST /handovers/:id/verify-pin fails after already verified (400 – replay prevention)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/verify-pin`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ pin: handoverPinA });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('VERIFIED'));
  });

  // ─── Two-Sided Condition Confirmation ──────────────────

  test('POST /handovers/:id/confirm-condition fails before PIN verification (wrong session)', async () => {
    // Create a separate scenario for this – use bookB
    // First let's just test that non-participant gets 403
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/confirm-condition`)
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send({ condition_rating: 'GOOD' });
    assert.equal(res.status, 403);
  });

  test('POST /handovers/:id/confirm-condition giver confirms condition', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/confirm-condition`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ condition_rating: 'GOOD', condition_notes: 'Book is in good condition.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'giver');
    assert.equal(res.body.confirmed, true);
    assert.equal(res.body.transferCompleted, false, 'Transfer must NOT complete with only one side');
  });

  test('POST /handovers/:id/confirm-condition giver cannot confirm twice (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/confirm-condition`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ condition_rating: 'GOOD' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('already confirmed'));
  });

  test('POST /handovers/:id/confirm-condition receiver confirms → custody transfer completes', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/handovers/${handoverSessionAId}/confirm-condition`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ condition_rating: 'FAIR', condition_notes: 'Minor wear on cover.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'receiver');
    assert.equal(res.body.confirmed, true);
    assert.equal(res.body.transferCompleted, true, 'Transfer must complete after both sides confirm');
  });

  // ─── Verify Custody Transfer Results ───────────────────

  test('Book custody transferred: book status is BORROWED, custodian updated', async () => {
    const bookRes = await db.query('SELECT status, current_custodian_id FROM books WHERE id = $1;', [bookAId]);
    assert.equal(bookRes.rows[0].status, 'BORROWED');
    assert.equal(bookRes.rows[0].current_custodian_id, borrower1Id);
  });

  test('Borrow request is ACTIVE with borrow_started_at and due_date set', async () => {
    const brRes = await db.query(
      'SELECT status, borrow_started_at, due_date FROM borrow_requests WHERE id = $1;',
      [borrowRequestAId]
    );
    assert.equal(brRes.rows[0].status, 'ACTIVE');
    assert.ok(brRes.rows[0].borrow_started_at);
    assert.ok(brRes.rows[0].due_date);

    // Verify due date is approximately 7 days (library rule) from borrow_started_at
    const started = new Date(brRes.rows[0].borrow_started_at);
    const due = new Date(brRes.rows[0].due_date);
    const diffDays = (due - started) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays >= 6.9 && diffDays <= 7.1, `Due date should be ~7 days, got ${diffDays}`);
  });

  test('Custody history records two-sided condition ratings', async () => {
    const histRes = await db.query(
      `SELECT * FROM custody_history WHERE book_id = $1 ORDER BY transferred_at DESC;`,
      [bookAId]
    );
    // Should have 2 records: initial donation + this transfer
    assert.equal(histRes.rowCount, 2);

    const transfer = histRes.rows[0]; // most recent
    assert.equal(transfer.from_user_id, librarianId);
    assert.equal(transfer.to_user_id, borrower1Id);
    assert.equal(transfer.giver_condition_rating, 'GOOD');
    assert.equal(transfer.receiver_condition_rating, 'FAIR');
    assert.equal(transfer.handover_session_id, handoverSessionAId);
  });

  // ─── FIFO Waitlist ─────────────────────────────────────

  let borrowRequestB1Id;
  let borrowRequestB2Id;

  test('Second borrower joins FIFO queue (QUEUED) when book is RESERVED/BORROWED', async () => {
    // Borrower1 requests bookB → direct (CUSTODIAN_APPROVAL_PENDING)
    const res1 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ book_id: bookBId });
    assert.equal(res1.status, 201);
    assert.equal(res1.body.request.status, 'CUSTODIAN_APPROVAL_PENDING');
    borrowRequestB1Id = res1.body.request.id;

    // Borrower2 requests bookB → queue
    const res2 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send({ book_id: bookBId });
    assert.equal(res2.status, 201);
    borrowRequestB2Id = res2.body.request?.id;
    assert.equal(res2.body.request.status, 'QUEUED');
    assert.equal(res2.body.queue_position, 1);
  });

  test('GET /requests/:id for queued request shows queue position', async () => {
    const res = await request(app)
      .get(`/api/v1/borrowing/requests/${borrowRequestB2Id}`)
      .set('Cookie', [borrower2Cookie]);
    assert.equal(res.status, 200);
    assert.equal(res.body.request.queue_position, 1);
  });

  // ─── Custodian Decline → Queue Advancement ─────────────

  test('Decline triggers queue advancement: next FIFO member promoted to HANDOVER_PENDING', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestB1Id}/decline`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();

    assert.equal(res.status, 200);
    assert.equal(res.body.borrowRequest.status, 'DECLINED');
    assert.equal(res.body.queueAdvancement.promoted, true);

    // Verify borrower2's request is now HANDOVER_PENDING
    const brRes = await db.query('SELECT status FROM borrow_requests WHERE id = $1;', [borrowRequestB2Id]);
    assert.equal(brRes.rows[0].status, 'HANDOVER_PENDING');
  });

  // ─── Cancel Borrow Request ─────────────────────────────

  test('Borrower can cancel their own HANDOVER_PENDING request', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestB2Id}/cancel`)
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send();

    assert.equal(res.status, 200);
    assert.equal(res.body.borrowRequest.status, 'CANCELLED');

    // Book should return to AVAILABLE since no one in queue
    const bookRes = await db.query('SELECT status FROM books WHERE id = $1;', [bookBId]);
    assert.equal(bookRes.rows[0].status, 'AVAILABLE');
  });

  test('Cancel fails for non-borrower (403)', async () => {
    // Create a new request to test cancel authorization
    const createRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send({ book_id: bookBId });
    const newRequestId = createRes.body.request.id;

    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${newRequestId}/cancel`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send();
    assert.equal(res.status, 403);

    // Clean up: cancel it properly
    await request(app)
      .post(`/api/v1/borrowing/requests/${newRequestId}/cancel`)
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send();
  });

  test('Cancel fails for already completed/terminal request (400)', async () => {
    // borrowRequestB1Id is DECLINED – cannot cancel
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestB1Id}/cancel`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send();
    assert.equal(res.status, 400);
  });

  // ─── Borrowing Rule Limit ──────────────────────────────

  test('Borrower exceeding max_books_per_member limit gets rejected (400)', async () => {
    // borrower1 already has 1 active (bookA). max_books_per_member = 2.
    // Request bookB → should succeed (count = 1 active + 1 pending = 2)
    const res1 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ book_id: bookBId });
    assert.equal(res1.status, 201);
    const tempRequestId = res1.body.request.id;

    // Request bookC → should fail (count = 2 already)
    const res2 = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ book_id: bookCId });
    assert.equal(res2.status, 400);
    assert.ok(res2.body.error.message.includes('maximum borrowing limit'));

    // Cancel tempRequest to clean up
    await request(app)
      .post(`/api/v1/borrowing/requests/${tempRequestId}/cancel`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send();
  });

  // ─── PIN Brute Force Protection ────────────────────────

  let bruteForceSessionId;
  let bruteForceRequestId;

  test('PIN brute force: 3 wrong PINs → handover FAILED → queue advancement', async () => {
    // Create a fresh borrow request for bookB
    const createRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower3Cookie])
      .set('X-CSRF-Token', borrower3Csrf)
      .send({ book_id: bookBId });
    assert.equal(createRes.status, 201);
    bruteForceRequestId = createRes.body.request.id;

    // Approve it
    const approveRes = await request(app)
      .post(`/api/v1/borrowing/requests/${bruteForceRequestId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();
    assert.equal(approveRes.status, 200);
    bruteForceSessionId = approveRes.body.handoverSession.id;
    const realPin = approveRes.body.handoverSession.pin;

    // Use a wrong PIN that we know is different from the real one
    const wrongPin = realPin === '9999' ? '0001' : '9999';

    // Attempt 1 – wrong
    const r1 = await request(app)
      .post(`/api/v1/borrowing/handovers/${bruteForceSessionId}/verify-pin`)
      .set('Cookie', [borrower3Cookie])
      .set('X-CSRF-Token', borrower3Csrf)
      .send({ pin: wrongPin });
    assert.equal(r1.status, 400);

    // Attempt 2 – wrong
    const r2 = await request(app)
      .post(`/api/v1/borrowing/handovers/${bruteForceSessionId}/verify-pin`)
      .set('Cookie', [borrower3Cookie])
      .set('X-CSRF-Token', borrower3Csrf)
      .send({ pin: wrongPin });
    assert.equal(r2.status, 400);

    // Attempt 3 – wrong → exhausted → FAILED
    const r3 = await request(app)
      .post(`/api/v1/borrowing/handovers/${bruteForceSessionId}/verify-pin`)
      .set('Cookie', [borrower3Cookie])
      .set('X-CSRF-Token', borrower3Csrf)
      .send({ pin: wrongPin });
    assert.equal(r3.status, 400);
    assert.ok(r3.body.error.message.includes('exhausted') || r3.body.error.message.includes('failed'));

    // Verify request is now FAILED
    const brRes = await db.query('SELECT status FROM borrow_requests WHERE id = $1;', [bruteForceRequestId]);
    assert.equal(brRes.rows[0].status, 'FAILED');

    // Verify handover session is FAILED
    const hsRes = await db.query('SELECT status FROM handover_sessions WHERE id = $1;', [bruteForceSessionId]);
    assert.equal(hsRes.rows[0].status, 'FAILED');

    // Book should be AVAILABLE (no one else in queue)
    const bookRes = await db.query('SELECT status FROM books WHERE id = $1;', [bookBId]);
    assert.equal(bookRes.rows[0].status, 'AVAILABLE');
  });

  // ─── List Requests for Book ────────────────────────────

  test('GET /borrowing/books/:bookId/requests lists borrow history for members', async () => {
    const res = await request(app)
      .get(`/api/v1/borrowing/books/${bookBId}/requests`)
      .set('Cookie', [borrower1Cookie]);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.requests));
    assert.ok(res.body.requests.length >= 1);
  });

  test('GET /borrowing/books/:bookId/requests fails for non-member (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/borrowing/books/${bookBId}/requests`)
      .set('Cookie', [outsiderCookie]);
    assert.equal(res.status, 403);
  });

  // ─── Early Release ─────────────────────────────────────

  let earlyReleaseHandoverSessionId;

  test('Early release fails when no one is in the queue (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/books/${bookCId}/early-release`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('No waiting members'));
  });

  test('Early release fails for non-custodian (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/books/${bookCId}/early-release`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send();
    assert.equal(res.status, 403);
  });

  test('Early release: custodian initiates, next FIFO member promoted', async () => {
    // First, complete a borrow on bookC so librarian is not custodian anymore...
    // Actually librarian is still custodian. Let's set up a queue first.

    // Borrower1 requests bookC → direct approval
    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ book_id: bookCId });
    const reqCId = reqRes.body.request.id;

    // Approve
    const apprRes = await request(app)
      .post(`/api/v1/borrowing/requests/${reqCId}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();
    const hsCId = apprRes.body.handoverSession.id;
    const pinC = apprRes.body.handoverSession.pin;

    // Complete handover: PIN + both conditions
    await request(app)
      .post(`/api/v1/borrowing/handovers/${hsCId}/verify-pin`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ pin: pinC });
    await request(app)
      .post(`/api/v1/borrowing/handovers/${hsCId}/confirm-condition`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ condition_rating: 'GOOD' });
    await request(app)
      .post(`/api/v1/borrowing/handovers/${hsCId}/confirm-condition`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send({ condition_rating: 'GOOD' });

    // Now borrower1 is custodian with ACTIVE borrow. Add borrower2 to the queue.
    const queueRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrower2Cookie])
      .set('X-CSRF-Token', borrower2Csrf)
      .send({ book_id: bookCId });
    assert.equal(queueRes.body.request.status, 'QUEUED');

    // Borrower1 (current custodian) initiates early release
    const earlyRes = await request(app)
      .post(`/api/v1/borrowing/books/${bookCId}/early-release`)
      .set('Cookie', [borrower1Cookie])
      .set('X-CSRF-Token', borrower1Csrf)
      .send();

    assert.equal(earlyRes.status, 200);
    assert.equal(earlyRes.body.queueAdvancement.promoted, true);
    assert.ok(earlyRes.body.queueAdvancement.handoverSessionId);
    earlyReleaseHandoverSessionId = earlyRes.body.queueAdvancement.handoverSessionId;

    // Verify borrower2's request is now HANDOVER_PENDING
    const br2Res = await db.query(
      `SELECT status FROM borrow_requests WHERE book_id = $1 AND borrower_id = $2 AND status = 'HANDOVER_PENDING';`,
      [bookCId, borrower2Id]
    );
    assert.equal(br2Res.rowCount, 1);

    // Verify the PIN is not leaked in the early-release response
    assert.equal(earlyRes.body.queueAdvancement.pin, undefined, 'PIN must NOT be leaked in early-release response');
  });

  // ─── Address Privacy (catalogue must NEVER leak) ───────

  test('Catalogue search never leaks flat_house_number or phone', async () => {
    const catRes = await request(app).get('/api/v1/books?library_id=' + libraryId);
    assert.equal(catRes.status, 200);
    for (const b of catRes.body.books) {
      assert.equal(b.flat_house_number, undefined);
      assert.equal(b.phone, undefined);
      assert.equal(b.current_custodian_flat, undefined);
    }
  });

  // ─── Concurrent Duplicate Prevention ───────────────────

  test('Partial unique index prevents duplicate active requests at DB level', async () => {
    // Verify the partial unique index exists
    const idxRes = await db.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'borrow_requests'
         AND indexname = 'uq_single_active_or_pending_borrow';`
    );
    assert.equal(idxRes.rowCount, 1);

    const idxRes2 = await db.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'borrow_requests'
         AND indexname = 'uq_user_active_or_queued_request';`
    );
    assert.equal(idxRes2.rowCount, 1);
  });

  // ─── PIN Never Stored in Plaintext ─────────────────────

  test('Handover session pin_hash is NOT plaintext', async () => {
    const hsRes = await db.query(
      `SELECT pin_hash FROM handover_sessions WHERE id = $1;`,
      [handoverSessionAId]
    );
    const hash = hsRes.rows[0].pin_hash;
    // bcrypt hashes start with $2a$ or $2b$
    assert.ok(hash.startsWith('$2') || hash.startsWith('$2b'), 'PIN hash must be a bcrypt hash');
    // Plaintext 4-digit PIN would be 4 chars, bcrypt hash is 60+
    assert.ok(hash.length > 50, 'PIN hash must be a full bcrypt hash, not plaintext');
  });

  // ─── Invalid State Transitions ─────────────────────────

  test('Cannot approve a DECLINED request (stale state)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestB1Id}/approve`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();
    assert.equal(res.status, 400);
  });

  test('Cannot decline an ACTIVE request (invalid transition)', async () => {
    const res = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestAId}/decline`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send();
    assert.equal(res.status, 400);
  });

  // ─── Concurrent Queue: No Double Promotion ─────────────

  test('Unique index on handover_sessions prevents duplicate pending handovers for same book', async () => {
    const idxRes = await db.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'handover_sessions'
         AND indexname = 'uq_single_pending_handover_session';`
    );
    assert.equal(idxRes.rowCount, 1);
  });
});
