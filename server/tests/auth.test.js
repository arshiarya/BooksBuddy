const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Authentication & Server-Side Sessions (Phase 3)', () => {
  before(() => {
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }
  });

  after(async () => {
    // Clean up test user and sessions created during testing
    await db.query("DELETE FROM users WHERE email LIKE 'authtest_%@example.com';");
    if (authRoutes.authLimiter?.reset) {
      authRoutes.authLimiter.reset();
    }
  });

  const uniqueEmail = `authtest_${Date.now()}@example.com`;
  const validUser = {
    email: uniqueEmail,
    password: 'Password123!',
    full_name: 'Test Resident',
    phone: '+919876543299',
    society_locality: 'Greenwood Estate, Bellandur',
    flat_house_number: 'Tower D-501',
    city: 'Bengaluru',
  };

  let sessionCookie = '';
  let csrfToken = '';
  let initialSessionId = '';

  test('POST /api/v1/auth/register fails with 400 when password is weak', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validUser,
        email: `weak_${Date.now()}@example.com`,
        password: 'weak',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.statusCode, 400);
    assert.ok(res.body.error.message.includes('Password'));
  });

  test('POST /api/v1/auth/register creates user and establishes server session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser);

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, uniqueEmail.toLowerCase());
    assert.equal(res.body.user.fullName || res.body.user.full_name, validUser.full_name);
    // Never expose password hash
    assert.equal(res.body.user.password_hash, undefined);
    assert.ok(res.body.csrfToken);

    // Verify Set-Cookie headers
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'set-cookie header must be present');

    const sidCookie = cookies.find((c) => c.startsWith('booksbuddy_sid='));
    const csrfCookie = cookies.find((c) => c.startsWith('booksbuddy_csrf='));

    assert.ok(sidCookie, 'booksbuddy_sid cookie must be set');
    assert.ok(csrfCookie, 'booksbuddy_csrf cookie must be set');
    assert.ok(sidCookie.includes('HttpOnly'), 'booksbuddy_sid must be HttpOnly');
    assert.ok(sidCookie.includes('SameSite=Lax'), 'booksbuddy_sid must have SameSite=Lax');

    // Extract session ID
    initialSessionId = sidCookie.split(';')[0].split('=')[1];
    csrfToken = res.body.csrfToken;

    // Verify session row exists in PostgreSQL
    const sessionInDb = await db.query('SELECT * FROM sessions WHERE id = $1;', [initialSessionId]);
    assert.equal(sessionInDb.rowCount, 1);
    assert.equal(sessionInDb.rows[0].csrf_token, csrfToken);
  });

  test('POST /api/v1/auth/register fails with 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.statusCode, 409);
    assert.ok(res.body.error.message.includes('already exists'));
  });

  test('POST /api/v1/auth/login fails with 401 on incorrect password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: uniqueEmail,
        password: 'WrongPassword!',
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Invalid email or password.');
  });

  test('POST /api/v1/auth/login succeeds and rotates session (fixation protection)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', [`booksbuddy_sid=${initialSessionId}`])
      .send({
        email: uniqueEmail,
        password: validUser.password,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, uniqueEmail.toLowerCase());
    assert.equal(res.body.user.password_hash, undefined);
    assert.ok(res.body.csrfToken);

    const cookies = res.headers['set-cookie'];
    const sidCookie = cookies.find((c) => c.startsWith('booksbuddy_sid='));
    const newSessionId = sidCookie.split(';')[0].split('=')[1];

    // Session fixation check: new session ID must differ from initial session ID
    assert.notEqual(newSessionId, initialSessionId, 'Login must rotate session ID');

    // Old session must no longer exist in DB
    const oldSession = await db.query('SELECT id FROM sessions WHERE id = $1;', [initialSessionId]);
    assert.equal(oldSession.rowCount, 0, 'Old session must be deleted on rotation');

    // New session must exist
    const newSession = await db.query('SELECT id FROM sessions WHERE id = $1;', [newSessionId]);
    assert.equal(newSession.rowCount, 1, 'New session must exist in DB');

    // Store for subsequent tests
    sessionCookie = sidCookie.split(';')[0];
    csrfToken = res.body.csrfToken;
  });

  test('Regression: POST /api/v1/auth/login hydrates user memberships immediately without page refresh', async () => {
    // Get validUser ID
    const userRes = await db.query('SELECT id FROM users WHERE email = $1;', [uniqueEmail.toLowerCase()]);
    const userId = userRes.rows[0].id;

    // 1. Create a library and add validUser as an APPROVED member
    const libRes = await db.query(
      `INSERT INTO libraries (name, slug, society_locality, city, invite_code, created_by)
       VALUES ('Hydration Test Library', $1, 'Test Locality', 'Bengaluru', 'TEST-HYD1', $2)
       RETURNING id;`,
      [`hyd-test-${Date.now()}`, userId]
    );
    const libId = libRes.rows[0].id;

    await db.query(
      `INSERT INTO library_members (library_id, user_id, role, status)
       VALUES ($1, $2, 'MEMBER', 'APPROVED');`,
      [libId, userId]
    );

    // 2. Perform fresh login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: uniqueEmail,
        password: validUser.password,
      });

    assert.equal(loginRes.status, 200);
    // Crucial regression assertion: user returned on login MUST contain memberships array
    assert.ok(Array.isArray(loginRes.body.user.memberships), 'Login response must contain memberships array');
    const hasMembership = loginRes.body.user.memberships.some(
      (m) => Number(m.library_id) === Number(libId) && m.status === 'APPROVED'
    );
    assert.ok(hasMembership, 'Approved membership must be immediately hydrated in login response');

    // Clean up test library
    await db.query('DELETE FROM libraries WHERE id = $1;', [libId]);
  });

  test('GET /api/v1/auth/me returns authenticated user profile and memberships', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [sessionCookie]);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, uniqueEmail.toLowerCase());
    assert.ok(Array.isArray(res.body.user.memberships));
    assert.equal(res.body.user.password_hash, undefined);
  });

  test('GET /api/v1/auth/me returns 401 when no session cookie is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.statusCode, 401);
  });

  test('GET /api/v1/auth/me returns 401 for forged/invalid session ID', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', ['booksbuddy_sid=forged_non_existent_session_id_1234567890']);

    assert.equal(res.status, 401);
  });

  test('POST /api/v1/auth/logout without CSRF token returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [sessionCookie]);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('CSRF token'));
  });

  test('POST /api/v1/auth/logout with wrong CSRF token returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [sessionCookie])
      .set('X-CSRF-Token', 'wrong_csrf_token_value');

    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('CSRF token'));
  });

  test('POST /api/v1/auth/logout with valid CSRF token logs out and invalidates session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [sessionCookie])
      .set('X-CSRF-Token', csrfToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Logged out successfully.');

    // Verify session was deleted from database
    const sid = sessionCookie.split('=')[1];
    const checkDb = await db.query('SELECT id FROM sessions WHERE id = $1;', [sid]);
    assert.equal(checkDb.rowCount, 0, 'Session must be deleted from DB upon logout');

    // Subsequent call to /me with old cookie must fail with 401
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [sessionCookie]);
    assert.equal(meRes.status, 401);
  });

  test('Rate limiter blocks excessive requests with 429 Too Many Requests', async () => {
    // Send 30 rapid requests to test rate limit
    let hitRateLimit = false;
    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'bad@example.com', password: 'bad' });

      if (res.status === 429) {
        hitRateLimit = true;
        assert.equal(res.body.error.statusCode, 429);
        assert.ok(res.headers['retry-after']);
        break;
      }
    }

    assert.equal(hitRateLimit, true, 'Rate limiter must trigger 429 on excessive requests');
  });
});
