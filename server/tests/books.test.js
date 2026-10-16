const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Community Collection & Catalogue Management (Phase 5)', () => {
  let librarianCookie = '';
  let librarianCsrf = '';
  let librarianId = null;

  let memberCookie = '';
  let memberCsrf = '';
  let memberId = null;

  let outsiderCookie = '';
  let outsiderCsrf = '';

  let libraryId = null;
  let donatedBookId = null;

  before(async () => {
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }

    // 1. Register Librarian User
    const libEmail = `book_librarian_${Date.now()}@example.com`;
    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: libEmail,
        password: 'Password123!',
        full_name: 'Book Head Librarian',
        phone: '+919876543111',
        society_locality: 'Prestige Lakeside Habitat, Varthur',
        flat_house_number: 'Tower 3-1204',
        city: 'Bengaluru',
      });

    librarianCookie = reg1.headers['set-cookie']
      .find((c) => c.startsWith('booksbuddy_sid='))
      .split(';')[0];
    librarianCsrf = reg1.body.csrfToken;
    librarianId = reg1.body.user.id;

    // 2. Register Approved Member User
    const memEmail = `book_member_${Date.now()}@example.com`;
    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: memEmail,
        password: 'Password123!',
        full_name: 'Book Donor Member',
        phone: '+919876543222',
        society_locality: 'Prestige Lakeside Habitat, Varthur',
        flat_house_number: 'Tower 5-402',
        city: 'Bengaluru',
      });

    memberCookie = reg2.headers['set-cookie']
      .find((c) => c.startsWith('booksbuddy_sid='))
      .split(';')[0];
    memberCsrf = reg2.body.csrfToken;
    memberId = reg2.body.user.id;

    // 3. Register Outsider User (not a member of the library)
    const outEmail = `book_outsider_${Date.now()}@example.com`;
    const reg3 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: outEmail,
        password: 'Password123!',
        full_name: 'Outsider Resident',
        phone: '+919876543333',
        society_locality: 'Different Society, Whitefield',
        flat_house_number: 'Villa 1',
        city: 'Bengaluru',
      });

    outsiderCookie = reg3.headers['set-cookie']
      .find((c) => c.startsWith('booksbuddy_sid='))
      .split(';')[0];
    outsiderCsrf = reg3.body.csrfToken;

    // 4. Create Library (Librarian becomes PRIMARY_LIBRARIAN)
    const libRes = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        name: 'Prestige Lakeside Habitat Community Library',
        society_locality: 'Prestige Lakeside Habitat, Varthur',
        city: 'Bengaluru',
        description: 'Community library for Prestige Lakeside Habitat residents.',
      });

    libraryId = libRes.body.library.id;

    // 5. Member requests to join and Librarian approves
    const joinRes = await request(app)
      .post(`/api/v1/libraries/${libraryId}/join`)
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send();

    const membershipId = joinRes.body.membership.id;

    await request(app)
      .put(`/api/v1/libraries/${libraryId}/members/${membershipId}`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ status: 'APPROVED' });
  });

  after(async () => {
    // Clean up created test data safely in reverse dependency order
    try {
      const userIdsRes = await db.query("SELECT id FROM users WHERE email LIKE 'book_%@example.com';");
      const userIds = userIdsRes.rows.map((r) => r.id);
      if (userIds.length > 0) {
        await db.query('DELETE FROM custody_history WHERE to_user_id = ANY($1) OR from_user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM books WHERE original_donor_id = ANY($1) OR current_custodian_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM library_members WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM libraries WHERE created_by = ANY($1);', [userIds]);
        await db.query('DELETE FROM users WHERE id = ANY($1);', [userIds]);
      }
    } catch (err) {
      console.warn('[TEST CLEANUP WARNING]', err.message);
    }
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }
  });

  test('GET /api/v1/books/metadata/search returns results or empty list without crashing', async () => {
    const res = await request(app)
      .get('/api/v1/books/metadata/search?q=Clean+Code');

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
  });

  test('POST /api/v1/books fails with 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .send({
        library_id: libraryId,
        title: 'Unauth Book',
        author: 'Unknown',
      });

    assert.equal(res.status, 401);
  });

  test('POST /api/v1/books fails with 403 when user is not an approved member', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [outsiderCookie])
      .set('X-CSRF-Token', outsiderCsrf)
      .send({
        library_id: libraryId,
        title: 'Outsider Book',
        author: 'Unknown',
      });

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('approved member'));
  });

  test('POST /api/v1/books fails with 400 when title or author missing', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send({
        library_id: libraryId,
        title: '',
        author: 'Some Author',
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('title is required'));
  });

  test('POST /api/v1/books donates book: sets library ownership and keeps custody with donor', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send({
        library_id: libraryId,
        title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
        author: 'Gang of Four',
        isbn: '9780201633610',
        genre: 'Computer Science',
        description: 'Classic book on software design patterns.',
        initial_condition: 'GOOD',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.book.id);
    assert.equal(res.body.book.title, 'Design Patterns: Elements of Reusable Object-Oriented Software');
    assert.equal(res.body.book.library_id, libraryId);

    // Invariant: Permanent library collection attribution
    assert.equal(res.body.book.original_donor_id, memberId);
    // Invariant: Physical custody remains initially with donating member
    assert.equal(res.body.book.current_custodian_id, memberId);
    // Invariant: Immediately visible in catalogue
    assert.equal(res.body.book.status, 'AVAILABLE');

    donatedBookId = res.body.book.id;

    // Verify atomic initial custody_history record in DB
    const custodyCheck = await db.query(
      'SELECT * FROM custody_history WHERE book_id = $1;',
      [donatedBookId]
    );

    assert.equal(custodyCheck.rowCount, 1);
    assert.equal(custodyCheck.rows[0].from_user_id, null, 'Initial donation from_user_id must be NULL');
    assert.equal(custodyCheck.rows[0].to_user_id, memberId, 'Initial custody must belong to donor');
    assert.equal(custodyCheck.rows[0].giver_condition_rating, 'GOOD');
    assert.equal(custodyCheck.rows[0].receiver_condition_rating, 'GOOD');
  });

  test('GET /api/v1/books finds donated book in catalogue immediately and protects address privacy', async () => {
    const res = await request(app)
      .get(`/api/v1/books?library_id=${libraryId}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.books));
    assert.ok(res.body.books.length >= 1);

    const foundBook = res.body.books.find((b) => b.id == donatedBookId);
    assert.ok(foundBook, 'Donated book must appear immediately in catalogue');
    assert.equal(foundBook.status, 'AVAILABLE');
    assert.equal(foundBook.current_custodian_id, memberId);
    assert.equal(foundBook.original_donor_id, memberId);

    // Address Privacy Test: Assert flat_house_number and phone are NEVER returned
    for (const b of res.body.books) {
      assert.equal(b.flat_house_number, undefined, 'Flat/house number must NEVER leak in catalogue');
      assert.equal(b.phone, undefined, 'Phone must NEVER leak in catalogue');
      assert.equal(b.current_custodian_flat, undefined);
    }
  });

  test('GET /api/v1/books searches by title or author', async () => {
    const res = await request(app)
      .get(`/api/v1/books?library_id=${libraryId}&q=Design+Patterns`);

    assert.equal(res.status, 200);
    assert.ok(res.body.books.length >= 1);
    assert.equal(res.body.books[0].id, donatedBookId);
  });

  test('GET /api/v1/books/:id returns book details, donor attribution, and custody history timeline', async () => {
    const res = await request(app)
      .get(`/api/v1/books/${donatedBookId}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.book.id, donatedBookId);
    assert.equal(res.body.book.original_donor_id, memberId);
    assert.equal(res.body.book.original_donor_name, 'Book Donor Member');
    assert.equal(res.body.book.current_custodian_id, memberId);
    assert.ok(Array.isArray(res.body.book.custody_history));
    assert.equal(res.body.book.custody_history.length, 1);
    assert.equal(res.body.book.custody_history[0].to_user_name, 'Book Donor Member');

    // Address privacy check
    assert.equal(res.body.book.flat_house_number, undefined);
    assert.equal(res.body.book.phone, undefined);
  });

  test('GET /api/v1/books/:id returns 404 for non-existent book', async () => {
    const res = await request(app).get('/api/v1/books/99999999');
    assert.equal(res.status, 404);
  });

  test('DELETE /api/v1/books/:id fails with 403 for regular member', async () => {
    const res = await request(app)
      .delete(`/api/v1/books/${donatedBookId}`)
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send({ removal_reason: 'I changed my mind.' });

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('Librarian privileges required'));
  });

  test('DELETE /api/v1/books/:id fails with 400 when removal_reason is missing', async () => {
    const res = await request(app)
      .delete(`/api/v1/books/${donatedBookId}`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({});

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('removal reason'));
  });

  test('DELETE /api/v1/books/:id removes book and records removal reason and librarian', async () => {
    const res = await request(app)
      .delete(`/api/v1/books/${donatedBookId}`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ removal_reason: 'Book copy has water damage.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.book.status, 'REMOVED');
    assert.equal(res.body.book.removal_reason, 'Book copy has water damage.');
    assert.equal(res.body.book.removed_by, librarianId);

    // Verify it is excluded from default catalogue search
    const catRes = await request(app)
      .get(`/api/v1/books?library_id=${libraryId}`);
    assert.equal(catRes.status, 200);
    const stillPresent = catRes.body.books.some((b) => b.id == donatedBookId);
    assert.equal(stillPresent, false, 'Removed book must be excluded from catalogue search');
  });
});
