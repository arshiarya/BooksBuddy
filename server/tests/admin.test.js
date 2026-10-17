const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Platform Admin & Global Library Governance', () => {
  before(() => {
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }
  });

  after(async () => {
    // Clean up any test libraries created during admin testing
    await db.query("DELETE FROM libraries WHERE name LIKE 'AdminTest_%';");
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }
  });

  let adminCookie = '';
  let adminCsrf = '';
  let userCookie = '';
  let userCsrf = '';
  let testLibraryId = null;

  // 1. Authenticate normal member (Rohan Verma - User 3)
  test('Normal user login obtains standard USER role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'rohan@example.com',
        password: 'Password123!',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'USER');

    const cookies = res.headers['set-cookie'] || [];
    const sidCookie = cookies.find((c) => c.startsWith('booksbuddy_sid='));
    const csrfCookie = cookies.find((c) => c.startsWith('booksbuddy_csrf='));

    assert.ok(sidCookie);
    assert.ok(csrfCookie);

    userCookie = sidCookie.split(';')[0];
    userCsrf = csrfCookie.split(';')[0].replace('booksbuddy_csrf=', '');
  });

  // 2. Authenticate Platform Admin account
  test('Platform Admin logs in successfully and receives PLATFORM_ADMIN role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@booksbuddy.local',
        password: 'Admin#BB2026!LocalDev',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'admin@booksbuddy.local');
    assert.equal(res.body.user.role, 'PLATFORM_ADMIN');
    assert.equal(res.body.user.full_name, 'Platform Admin');

    const cookies = res.headers['set-cookie'] || [];
    const sidCookie = cookies.find((c) => c.startsWith('booksbuddy_sid='));
    const csrfCookie = cookies.find((c) => c.startsWith('booksbuddy_csrf='));

    assert.ok(sidCookie);
    assert.ok(csrfCookie);

    adminCookie = sidCookie.split(';')[0];
    adminCsrf = csrfCookie.split(';')[0].replace('booksbuddy_csrf=', '');
  });

  // 3. Platform Admin profile persistence via GET /api/v1/auth/me
  test('GET /api/v1/auth/me returns PLATFORM_ADMIN role across session hydration', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [adminCookie]);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'admin@booksbuddy.local');
    assert.equal(res.body.user.role, 'PLATFORM_ADMIN');
  });

  // 4. Access Control: Unauthenticated access rejected
  test('GET /api/v1/admin/libraries fails with 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/admin/libraries');
    assert.equal(res.status, 401);
  });

  // 5. Access Control: Normal user access rejected with 403 Forbidden
  test('GET /api/v1/admin/libraries fails with 403 for non-admin users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/libraries')
      .set('Cookie', [userCookie]);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('Platform administrator privileges required'));
  });

  // 6. Platform Admin retrieves all platform libraries
  test('GET /api/v1/admin/libraries succeeds for Platform Admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/libraries')
      .set('Cookie', [adminCookie]);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.libraries));
    assert.ok(res.body.libraries.length >= 1);

    const greenwood = res.body.libraries.find((l) => l.name === 'Greenwood Community Library');
    assert.ok(greenwood, 'Greenwood library must be listed');
    assert.equal(greenwood.status, 'ACTIVE');
    assert.ok(greenwood.creator_name);
    assert.ok(greenwood.total_members >= 1);
  });

  // 7. Platform Admin retrieves global platform statistics
  test('GET /api/v1/admin/stats returns global platform metrics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', [adminCookie]);

    assert.equal(res.status, 200);
    assert.ok(res.body.stats.totalLibraries >= 1);
    assert.ok(res.body.stats.totalUsers >= 5);
    assert.ok(res.body.stats.totalBooks >= 1);
  });

  // 8. Create a temporary library to test suspension and deletion
  test('Setup: Create temporary library for moderation testing', async () => {
    const insertRes = await db.query(`
      INSERT INTO libraries (name, slug, society_locality, city, description, created_by, status)
      VALUES ('AdminTest_Suspicious Library', 'admintest-suspicious-library', 'Sector 99', 'Bengaluru', 'Test library for removal', 1, 'ACTIVE')
      RETURNING id, name, status;
    `);
    testLibraryId = insertRes.rows[0].id;
    assert.ok(testLibraryId);
  });

  // 9. Suspend library: updates status to SUSPENDED
  test('PATCH /api/v1/admin/libraries/:id/status suspends library', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/libraries/${testLibraryId}/status`)
      .set('Cookie', [adminCookie])
      .set('X-CSRF-Token', adminCsrf)
      .send({ status: 'SUSPENDED' });

    assert.equal(res.status, 200);
    assert.equal(res.body.library.status, 'SUSPENDED');
  });

  // 10. Suspended library is shielded from public discovery
  test('Suspended library is excluded from public search results', async () => {
    const res = await request(app)
      .get('/api/v1/libraries?q=AdminTest_Suspicious');

    assert.equal(res.status, 200);
    const found = res.body.libraries.find((l) => l.id == testLibraryId);
    assert.equal(found, undefined, 'Suspended library must not appear in public search');
  });

  // 11. Reactivate library: updates status back to ACTIVE
  test('PATCH /api/v1/admin/libraries/:id/status reactivates library', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/libraries/${testLibraryId}/status`)
      .set('Cookie', [adminCookie])
      .set('X-CSRF-Token', adminCsrf)
      .send({ status: 'ACTIVE' });

    assert.equal(res.status, 200);
    assert.equal(res.body.library.status, 'ACTIVE');

    // Verify it reappears in public search
    const searchRes = await request(app)
      .get('/api/v1/libraries?q=AdminTest_Suspicious');
    assert.equal(searchRes.status, 200);
    const found = searchRes.body.libraries.find((l) => l.id == testLibraryId);
    assert.ok(found, 'Reactivated library must reappear in public search');
  });

  // 12. Delete library: permanently removes suspicious library
  test('DELETE /api/v1/admin/libraries/:id permanently removes library', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/libraries/${testLibraryId}`)
      .set('Cookie', [adminCookie])
      .set('X-CSRF-Token', adminCsrf);

    assert.equal(res.status, 200);
    assert.equal(res.body.result.success, true);

    // Verify no longer exists in DB
    const check = await db.query('SELECT id FROM libraries WHERE id = $1;', [testLibraryId]);
    assert.equal(check.rowCount, 0);
  });
});
