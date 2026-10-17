const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Libraries & Membership Management (Phase 4)', () => {
  let primaryLibrarianCookie = '';
  let primaryLibrarianCsrf = '';
  let primaryLibrarianId = null;

  let memberCookie = '';
  let memberCsrf = '';
  let memberId = null;

  let createdLibraryId = null;
  let createdLibrarySlug = '';
  let createdLibraryInviteCode = '';
  let pendingMembershipId = null;

  before(async () => {
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }

    // Register User 1: will create a library and become PRIMARY_LIBRARIAN
    const user1Email = `lib_creator_${Date.now()}@example.com`;
    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: user1Email,
        password: 'Password123!',
        full_name: 'Library Creator',
        phone: '+919876543201',
        society_locality: 'Palm Meadows, Whitefield',
        flat_house_number: 'Villa 42',
        city: 'Bengaluru',
      });

    primaryLibrarianCookie = reg1.headers['set-cookie']
      .find((c) => c.startsWith('booksbuddy_sid='))
      .split(';')[0];
    primaryLibrarianCsrf = reg1.body.csrfToken;
    primaryLibrarianId = reg1.body.user.id;

    // Register User 2: will apply to join the library
    const user2Email = `lib_applicant_${Date.now()}@example.com`;
    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: user2Email,
        password: 'Password123!',
        full_name: 'Library Applicant',
        phone: '+919876543202',
        society_locality: 'Palm Meadows, Whitefield',
        flat_house_number: 'Villa 88',
        city: 'Bengaluru',
      });

    memberCookie = reg2.headers['set-cookie']
      .find((c) => c.startsWith('booksbuddy_sid='))
      .split(';')[0];
    memberCsrf = reg2.body.csrfToken;
    memberId = reg2.body.user.id;
  });

  after(async () => {
    // Clean up created test data
    if (createdLibraryId) {
      await db.query('DELETE FROM libraries WHERE id = $1;', [createdLibraryId]);
    }
    await db.query("DELETE FROM users WHERE email LIKE 'lib_%@example.com';");
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }
  });

  test('GET /api/v1/libraries returns public directory of libraries', async () => {
    const res = await request(app).get('/api/v1/libraries');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.libraries));
    assert.ok(res.body.pagination);
    assert.ok(typeof res.body.pagination.total === 'number');

    // Verify invite_code is shielded from public listing
    for (const lib of res.body.libraries) {
      assert.equal(lib.invite_code, undefined, 'Public search must never leak invite_code');
    }
  });

  test('GET /api/v1/libraries search supports library name', async () => {
    const res = await request(app).get('/api/v1/libraries?q=Greenwood');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.libraries));
    assert.ok(res.body.libraries.length > 0);
    assert.ok(res.body.libraries.some((l) => l.name.includes('Greenwood')));
  });

  test('GET /api/v1/libraries search supports locality / society via q parameter', async () => {
    // Seeded library has society_locality = 'Greenwood Estate, Bellandur'
    const res = await request(app).get('/api/v1/libraries?q=Bellandur');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.libraries));
    assert.ok(res.body.libraries.length > 0);
    assert.ok(res.body.libraries.some((l) => l.society_locality.includes('Bellandur')));
  });

  test('GET /api/v1/libraries search supports explicit locality filter with partial text', async () => {
    const res = await request(app).get('/api/v1/libraries?locality=Estate');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.libraries));
    assert.ok(res.body.libraries.length > 0);
    assert.ok(res.body.libraries.some((l) => l.society_locality.includes('Estate')));
  });

  test('GET /api/v1/libraries search is case-insensitive', async () => {
    const resLower = await request(app).get('/api/v1/libraries?q=bellandur');
    const resUpper = await request(app).get('/api/v1/libraries?q=BELLANDUR');
    assert.equal(resLower.status, 200);
    assert.equal(resUpper.status, 200);
    assert.equal(resLower.body.libraries.length, resUpper.body.libraries.length);
    assert.ok(resLower.body.libraries.length > 0);
  });

  test('GET /api/v1/libraries search returns empty list for no results', async () => {
    const res = await request(app).get('/api/v1/libraries?q=NonExistentLocality123456');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.libraries));
    assert.equal(res.body.libraries.length, 0);
    assert.equal(res.body.pagination.total, 0);
  });

  test('POST /api/v1/libraries fails without authentication with 401', async () => {
    const res = await request(app)
      .post('/api/v1/libraries')
      .send({
        name: 'Unauth Library',
        society_locality: 'Palm Meadows',
        city: 'Bengaluru',
      });

    assert.equal(res.status, 401);
  });

  test('POST /api/v1/libraries fails with non-positive rule values', async () => {
    const res = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [primaryLibrarianCookie])
      .set('X-CSRF-Token', primaryLibrarianCsrf)
      .send({
        name: 'Invalid Rules Library',
        society_locality: 'Palm Meadows',
        city: 'Bengaluru',
        max_borrow_days: -5,
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('positive integer'));
  });

  test('POST /api/v1/libraries creates library and assigns creator as PRIMARY_LIBRARIAN', async () => {
    const res = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [primaryLibrarianCookie])
      .set('X-CSRF-Token', primaryLibrarianCsrf)
      .send({
        name: 'Palm Meadows Community Library',
        society_locality: 'Palm Meadows, Whitefield',
        city: 'Bengaluru',
        description: 'Neighborhood library for Palm Meadows residents.',
        max_borrow_days: 21,
        handover_window_hours: 36,
        max_books_per_member: 4,
        max_renewals: 2,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.library.id);
    assert.equal(res.body.library.name, 'Palm Meadows Community Library');
    assert.equal(res.body.library.slug, 'palm-meadows-community-library');
    assert.equal(res.body.library.max_borrow_days, 21);
    assert.equal(res.body.library.handover_window_hours, 36);
    assert.equal(res.body.library.max_books_per_member, 4);
    assert.equal(res.body.library.max_renewals, 2);
    assert.ok(res.body.library.invite_code);

    // Verify creator's membership in DB
    createdLibraryId = res.body.library.id;
    createdLibrarySlug = res.body.library.slug;
    createdLibraryInviteCode = res.body.library.invite_code;

    const memCheck = await db.query(
      'SELECT * FROM library_members WHERE library_id = $1 AND user_id = $2;',
      [createdLibraryId, primaryLibrarianId]
    );

    assert.equal(memCheck.rowCount, 1);
    assert.equal(memCheck.rows[0].role, 'PRIMARY_LIBRARIAN');
    assert.equal(memCheck.rows[0].status, 'APPROVED');
  });

  test('GET /api/v1/libraries/:id shields invite_code from non-librarians', async () => {
    // Unauthenticated request
    const unauthRes = await request(app).get(`/api/v1/libraries/${createdLibraryId}`);
    assert.equal(unauthRes.status, 200);
    assert.equal(unauthRes.body.library.invite_code, undefined, 'Public cannot see invite_code');

    // Authenticated as non-librarian member
    const memberRes = await request(app)
      .get(`/api/v1/libraries/${createdLibraryId}`)
      .set('Cookie', [memberCookie]);
    assert.equal(memberRes.status, 200);
    assert.equal(memberRes.body.library.invite_code, undefined, 'Regular user cannot see invite_code');

    // Authenticated as Primary Librarian
    const libRes = await request(app)
      .get(`/api/v1/libraries/${createdLibraryId}`)
      .set('Cookie', [primaryLibrarianCookie]);
    assert.equal(libRes.status, 200);
    assert.equal(libRes.body.library.invite_code, createdLibraryInviteCode, 'Librarian can see invite_code');
  });

  test('POST /api/v1/libraries/:id/join fails with invalid invite code', async () => {
    const res = await request(app)
      .post(`/api/v1/libraries/${createdLibraryId}/join`)
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send({
        invite_code: 'WRONG-CODE-999',
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('Invalid invitation code'));
  });

  test('POST /api/v1/libraries/:id/join succeeds and sets status to PENDING (even with valid invite code)', async () => {
    const res = await request(app)
      .post(`/api/v1/libraries/${createdLibraryId}/join`)
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send({
        invite_code: createdLibraryInviteCode,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.membership.role, 'MEMBER');
    // Invariant: status is strictly PENDING awaiting librarian approval
    assert.equal(res.body.membership.status, 'PENDING');

    pendingMembershipId = res.body.membership.id;
  });

  test('POST /api/v1/libraries/:id/join fails with 409 for duplicate application', async () => {
    const res = await request(app)
      .post(`/api/v1/libraries/${createdLibraryId}/join`)
      .set('Cookie', [memberCookie])
      .set('X-CSRF-Token', memberCsrf)
      .send();

    assert.equal(res.status, 409);
    assert.ok(res.body.error.message.includes('already pending'));
  });

  test('GET /api/v1/libraries/:id/members fails with 403 for non-librarians', async () => {
    const res = await request(app)
      .get(`/api/v1/libraries/${createdLibraryId}/members`)
      .set('Cookie', [memberCookie]);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('Librarian privileges required'));
  });

  test('GET /api/v1/libraries/:id/members succeeds for librarian and filters by status=PENDING', async () => {
    const res = await request(app)
      .get(`/api/v1/libraries/${createdLibraryId}/members?status=PENDING`)
      .set('Cookie', [primaryLibrarianCookie]);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.members));
    assert.ok(res.body.members.length >= 1);
    assert.equal(res.body.members[0].id, pendingMembershipId);
    assert.equal(res.body.members[0].status, 'PENDING');
  });

  test('PUT /api/v1/libraries/:id/members/:memberId approves pending member', async () => {
    const res = await request(app)
      .put(`/api/v1/libraries/${createdLibraryId}/members/${pendingMembershipId}`)
      .set('Cookie', [primaryLibrarianCookie])
      .set('X-CSRF-Token', primaryLibrarianCsrf)
      .send({
        status: 'APPROVED',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.member.status, 'APPROVED');
    assert.equal(res.body.member.approved_by, primaryLibrarianId);
    assert.ok(res.body.member.approved_at);
  });

  test('Primary Librarian can appoint an approved member as LIBRARIAN', async () => {
    const res = await request(app)
      .put(`/api/v1/libraries/${createdLibraryId}/members/${pendingMembershipId}`)
      .set('Cookie', [primaryLibrarianCookie])
      .set('X-CSRF-Token', primaryLibrarianCsrf)
      .send({
        role: 'LIBRARIAN',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.member.role, 'LIBRARIAN');
  });

  test('POST /api/v1/libraries/:id/invite-code regenerates invitation code', async () => {
    const res = await request(app)
      .post(`/api/v1/libraries/${createdLibraryId}/invite-code`)
      .set('Cookie', [primaryLibrarianCookie])
      .set('X-CSRF-Token', primaryLibrarianCsrf);

    assert.equal(res.status, 200);
    assert.ok(res.body.library.invite_code);
    assert.notEqual(res.body.library.invite_code, createdLibraryInviteCode);
  });

  test('PUT /api/v1/libraries/:id updates library rules', async () => {
    const res = await request(app)
      .put(`/api/v1/libraries/${createdLibraryId}`)
      .set('Cookie', [primaryLibrarianCookie])
      .set('X-CSRF-Token', primaryLibrarianCsrf)
      .send({
        max_borrow_days: 28,
        description: 'Updated neighborhood library description.',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.library.max_borrow_days, 28);
    assert.equal(res.body.library.description, 'Updated neighborhood library description.');
  });
});
