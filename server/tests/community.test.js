const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Community Features: Demands, Ledger & Notices (Phase 8)', () => {
  let librarianCookie, librarianCsrf, librarianId;
  let member1Cookie, member1Csrf, member1Id;
  let member2Cookie, member2Csrf, member2Id;
  let outsiderCookie, outsiderCsrf;

  let libraryId;
  let demandId;
  let notice1Id;
  let notice2Id;

  const ts = Date.now();

  async function registerUser(nameSuffix, emailPrefix) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Bypass-Rate-Limit', '1')
      .send({
        email: `${emailPrefix}_${ts}@example.com`,
        password: 'Password123!',
        full_name: `Comm Test ${nameSuffix}`,
        phone: `+9198765${String(ts).slice(-5)}`,
        society_locality: 'Community Society',
        flat_house_number: `Flat-${nameSuffix}`,
        city: 'CommCity',
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

  before(async () => {
    if (authRoutes.authLimiter?.reset) authRoutes.authLimiter.reset();

    // 1. Register users
    const lib = await registerUser('Librarian', 'comm_lib');
    librarianCookie = lib.cookie; librarianCsrf = lib.csrf; librarianId = lib.id;

    const m1 = await registerUser('Member1', 'comm_m1');
    member1Cookie = m1.cookie; member1Csrf = m1.csrf; member1Id = m1.id;

    const m2 = await registerUser('Member2', 'comm_m2');
    member2Cookie = m2.cookie; member2Csrf = m2.csrf; member2Id = m2.id;

    const out = await registerUser('Outsider', 'comm_out');
    outsiderCookie = out.cookie; outsiderCsrf = out.csrf;

    // 2. Create library (librarian is PRIMARY_LIBRARIAN)
    const libRes = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        name: `Community Test Library ${ts}`,
        society_locality: 'Community Society',
        city: 'CommCity',
      });
    libraryId = libRes.body.library.id;

    // 3. Approve member1 and member2
    await approveJoin(member1Id, member1Cookie, member1Csrf);
    await approveJoin(member2Id, member2Cookie, member2Csrf);
  });

  after(async () => {
    try {
      const userIdsRes = await db.query(
        `SELECT id FROM users WHERE email LIKE 'comm_%_${ts}@example.com';`
      );
      const userIds = userIdsRes.rows.map((r) => r.id);
      if (userIds.length > 0) {
        await db.query('DELETE FROM community_notices WHERE author_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM contributions_ledger WHERE recorded_by = ANY($1);', [userIds]);
        await db.query('DELETE FROM book_demand_votes WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM book_demands WHERE suggested_by = ANY($1);', [userIds]);
        await db.query('DELETE FROM library_members WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM libraries WHERE created_by = ANY($1);', [userIds]);
        await db.query('DELETE FROM sessions WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM users WHERE id = ANY($1);', [userIds]);
      }
    } catch (err) {
      console.warn('[DB CLEANUP WARNING]', err.message);
    }
    if (authRoutes.authLimiter?.reset) authRoutes.authLimiter.reset();
  });

  // ─── 1. Book Demand Wishlist Tests ───────────────────────

  test('POST /api/v1/community/:libraryId/demands fails without auth (401)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/${libraryId}/demands`)
      .send({ title: 'Refactoring', author: 'Martin Fowler' });
    assert.equal(res.status, 401);
  });

  test('POST /api/v1/community/:libraryId/demands fails for outsider (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/${libraryId}/demands`)
      .set('Cookie', [outsiderCookie])
      .set('X-CSRF-Token', outsiderCsrf)
      .send({ title: 'Refactoring', author: 'Martin Fowler' });
    assert.equal(res.status, 403);
  });

  test('POST /api/v1/community/:libraryId/demands fails without title or author (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/${libraryId}/demands`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send({ title: '', author: 'Martin Fowler' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('title is required'));
  });

  test('POST /api/v1/community/:libraryId/demands creates demand with initial vote (201)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/${libraryId}/demands`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send({
        title: 'Refactoring: Improving the Design of Existing Code',
        author: 'Martin Fowler',
        isbn: '9780201485677',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.demand.id);
    assert.equal(res.body.demand.title, 'Refactoring: Improving the Design of Existing Code');
    assert.equal(res.body.demand.upvotes_count, 1);
    assert.equal(res.body.demand.has_voted, true);
    assert.equal(res.body.demand.status, 'REQUESTED');
    demandId = res.body.demand.id;

    // Verify database row in book_demand_votes
    const voteRes = await db.query(
      'SELECT * FROM book_demand_votes WHERE demand_id = $1 AND user_id = $2;',
      [demandId, member1Id]
    );
    assert.equal(voteRes.rowCount, 1);
  });

  test('GET /api/v1/community/:libraryId/demands lists demands with vote flag', async () => {
    const res = await request(app)
      .get(`/api/v1/community/${libraryId}/demands`)
      .set('Cookie', [member1Cookie]);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.demands));
    assert.ok(res.body.demands.length >= 1);

    const found = res.body.demands.find((d) => d.id == demandId);
    assert.ok(found);
    assert.equal(found.has_voted, true, 'Creator must have has_voted = true');
    assert.equal(found.upvotes_count, 1);
  });

  test('POST /api/v1/community/demands/:id/vote toggles upvote off and on', async () => {
    // 1. Creator member1 un-votes (toggles off)
    const unvoteRes = await request(app)
      .post(`/api/v1/community/demands/${demandId}/vote`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send();

    assert.equal(unvoteRes.status, 200);
    assert.equal(unvoteRes.body.hasVoted, false);
    assert.equal(unvoteRes.body.upvotes_count, 0);

    // 2. Member2 votes (toggles on)
    const voteRes2 = await request(app)
      .post(`/api/v1/community/demands/${demandId}/vote`)
      .set('Cookie', [member2Cookie])
      .set('X-CSRF-Token', member2Csrf)
      .send();

    assert.equal(voteRes2.status, 200);
    assert.equal(voteRes2.body.hasVoted, true);
    assert.equal(voteRes2.body.upvotes_count, 1);

    // 3. Member1 votes again (toggles on)
    const voteRes1 = await request(app)
      .post(`/api/v1/community/demands/${demandId}/vote`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send();

    assert.equal(voteRes1.status, 200);
    assert.equal(voteRes1.body.hasVoted, true);
    assert.equal(voteRes1.body.upvotes_count, 2);
  });

  test('POST /api/v1/community/demands/:id/vote fails for outsider (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/demands/${demandId}/vote`)
      .set('Cookie', [outsiderCookie])
      .set('X-CSRF-Token', outsiderCsrf)
      .send();
    assert.equal(res.status, 403);
  });

  test('PUT /api/v1/community/demands/:id/status fails for regular member (403)', async () => {
    const res = await request(app)
      .put(`/api/v1/community/demands/${demandId}/status`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send({ status: 'APPROVED_FOR_PURCHASE' });
    assert.equal(res.status, 403);
  });

  test('PUT /api/v1/community/demands/:id/status fails with invalid status (400)', async () => {
    const res = await request(app)
      .put(`/api/v1/community/demands/${demandId}/status`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({ status: 'INVALID_STATUS' });
    assert.equal(res.status, 400);
  });

  test('PUT /api/v1/community/demands/:id/status librarian approves and updates notes (200)', async () => {
    const res = await request(app)
      .put(`/api/v1/community/demands/${demandId}/status`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        status: 'APPROVED_FOR_PURCHASE',
        librarian_notes: 'Approved during monthly society meeting.',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.demand.status, 'APPROVED_FOR_PURCHASE');
    assert.equal(res.body.demand.librarian_notes, 'Approved during monthly society meeting.');
  });

  // ─── 2. Voluntary Contributions Ledger Tests ─────────────

  test('GET /api/v1/community/:libraryId/ledger fails for outsider (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [outsiderCookie]);
    assert.equal(res.status, 403);
  });

  test('POST /api/v1/community/:libraryId/ledger fails for non-librarian (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send({
        type: 'DONATION',
        amount: 500,
        description: 'Member contribution',
      });
    assert.equal(res.status, 403);
  });

  test('POST /api/v1/community/:libraryId/ledger validates amount and description (400)', async () => {
    const res1 = await request(app)
      .post(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        type: 'DONATION',
        amount: -50,
        description: 'Invalid',
      });
    assert.equal(res1.status, 400);

    const res2 = await request(app)
      .post(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        type: 'DONATION',
        amount: 100,
        description: '',
      });
    assert.equal(res2.status, 400);
  });

  test('POST /api/v1/community/:libraryId/ledger records donation and expense accurately', async () => {
    // 1. Record Donation of 1500.00
    const donRes = await request(app)
      .post(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        type: 'DONATION',
        amount: 1500,
        description: 'Society annual book fund donation',
        user_id: member1Id,
      });

    assert.equal(donRes.status, 201);
    assert.equal(donRes.body.entry.amount, 1500);
    assert.equal(donRes.body.entry.type, 'DONATION');

    // 2. Record Expense of 450.00
    const expRes = await request(app)
      .post(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        type: 'EXPENSE',
        amount: 450,
        description: 'Purchase of 2 new children books',
      });

    assert.equal(expRes.status, 201);
    assert.equal(expRes.body.entry.amount, 450);
    assert.equal(expRes.body.entry.type, 'EXPENSE');

    // 3. Verify running summary via GET
    const getRes = await request(app)
      .get(`/api/v1/community/${libraryId}/ledger`)
      .set('Cookie', [member2Cookie]);

    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.summary.totalDonations, 1500);
    assert.equal(getRes.body.summary.totalExpenses, 450);
    assert.equal(getRes.body.summary.netBalance, 1050); // 1500 - 450 = 1050
    assert.ok(getRes.body.entries.length >= 2);
  });

  // ─── 3. Community Notices Tests ─────────────────────────

  test('POST /api/v1/community/:libraryId/notices validates future expiry (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/community/${libraryId}/notices`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send({
        title: 'Past Notice',
        description: 'Past Description',
        category: 'EVENT',
        contact_info: 'test@example.com',
        expires_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('future timestamp'));
  });

  test('POST /api/v1/community/:libraryId/notices posts valid notices', async () => {
    const futureExpiry1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const futureExpiry2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Notice 1 by member1
    const res1 = await request(app)
      .post(`/api/v1/community/${libraryId}/notices`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf)
      .send({
        title: 'Weekend Book Club Discussion',
        description: 'Discussing Clean Code chapters 1-5 in the clubhouse.',
        category: 'BOOK_CLUB',
        contact_info: 'Flat 402 or in-app chat',
        expires_at: futureExpiry1,
      });

    assert.equal(res1.status, 201);
    assert.ok(res1.body.notice.id);
    notice1Id = res1.body.notice.id;

    // Notice 2 by librarian
    const res2 = await request(app)
      .post(`/api/v1/community/${libraryId}/notices`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf)
      .send({
        title: 'New Books Added to Virtual Catalogue',
        description: '10 new titles were donated this week! Check the catalogue.',
        category: 'ANNOUNCEMENT',
        contact_info: 'Librarian office',
        expires_at: futureExpiry2,
      });

    assert.equal(res2.status, 201);
    notice2Id = res2.body.notice.id;
  });

  test('GET /api/v1/community/:libraryId/notices lists active notices and filters by category', async () => {
    // 1. All active notices
    const allRes = await request(app)
      .get(`/api/v1/community/${libraryId}/notices`)
      .set('Cookie', [member2Cookie]);

    assert.equal(allRes.status, 200);
    assert.ok(Array.isArray(allRes.body.notices));
    assert.ok(allRes.body.notices.length >= 2);

    // 2. Filter by category
    const catRes = await request(app)
      .get(`/api/v1/community/${libraryId}/notices?category=BOOK_CLUB`)
      .set('Cookie', [member2Cookie]);

    assert.equal(catRes.status, 200);
    assert.ok(catRes.body.notices.every((n) => n.category === 'BOOK_CLUB'));
    assert.ok(catRes.body.notices.some((n) => n.id == notice1Id));
  });

  test('DELETE /api/v1/community/notices/:id fails for unauthorized member (403)', async () => {
    // member2 tries to delete notice1 (authored by member1)
    const res = await request(app)
      .delete(`/api/v1/community/notices/${notice1Id}`)
      .set('Cookie', [member2Cookie])
      .set('X-CSRF-Token', member2Csrf);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('Only the author or a librarian'));
  });

  test('DELETE /api/v1/community/notices/:id author can delete own notice', async () => {
    // member1 deletes notice1
    const res = await request(app)
      .delete(`/api/v1/community/notices/${notice1Id}`)
      .set('Cookie', [member1Cookie])
      .set('X-CSRF-Token', member1Csrf);

    assert.equal(res.status, 200);
    assert.equal(res.body.notice.is_removed, true);

    // Verify it is excluded from list
    const listRes = await request(app)
      .get(`/api/v1/community/${libraryId}/notices`)
      .set('Cookie', [member1Cookie]);

    assert.ok(!listRes.body.notices.some((n) => n.id == notice1Id));
  });

  test('DELETE /api/v1/community/notices/:id librarian can delete any notice', async () => {
    // Librarian deletes notice2
    const res = await request(app)
      .delete(`/api/v1/community/notices/${notice2Id}`)
      .set('Cookie', [librarianCookie])
      .set('X-CSRF-Token', librarianCsrf);

    assert.equal(res.status, 200);
    assert.equal(res.body.notice.is_removed, true);
  });
});
