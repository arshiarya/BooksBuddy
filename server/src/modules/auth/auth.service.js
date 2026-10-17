const db = require('../../config/db');
const env = require('../../config/env');
const security = require('../../utils/security');

/**
 * Creates a new server-side session in PostgreSQL.
 * @param {string|number} userId 
 * @returns {Promise<{ sessionId: string, csrfToken: string, expiresAt: Date }>}
 */
async function createSession(userId) {
  const sessionId = security.generateRandomToken(32); // 64 hex chars
  const csrfToken = security.generateRandomToken(32); // 64 hex chars
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const res = await db.query(
    `INSERT INTO sessions (id, user_id, expires_at, csrf_token, last_accessed_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     RETURNING id, user_id, expires_at, csrf_token;`,
    [sessionId, userId, expiresAt, csrfToken]
  );

  return {
    sessionId: res.rows[0].id,
    csrfToken: res.rows[0].csrf_token,
    expiresAt: res.rows[0].expires_at,
  };
}

/**
 * Invalidate/delete a session from PostgreSQL.
 * @param {string} sessionId 
 * @returns {Promise<boolean>}
 */
async function deleteSession(sessionId) {
  if (!sessionId) return false;
  const res = await db.query('DELETE FROM sessions WHERE id = $1;', [sessionId]);
  return res.rowCount > 0;
}

/**
 * Rotates an existing session on login to prevent session fixation.
 * @param {string|null} oldSessionId 
 * @param {string|number} userId 
 * @returns {Promise<{ sessionId: string, csrfToken: string, expiresAt: Date }>}
 */
async function rotateSession(oldSessionId, userId) {
  if (oldSessionId) {
    await deleteSession(oldSessionId);
  }
  return createSession(userId);
}

/**
 * Registers a new user and generates a server session.
 */
async function registerUser({
  email,
  password,
  full_name,
  phone,
  society_locality,
  flat_house_number,
  city,
}) {
  const normalizedEmail = email.trim().toLowerCase();

  // Check if email already registered
  const existingUser = await db.query(
    'SELECT id FROM users WHERE email = $1;',
    [normalizedEmail]
  );

  if (existingUser.rowCount > 0) {
    const error = new Error('An account with this email address already exists.');
    error.statusCode = 409;
    throw error;
  }

  // Hash password with bcrypt (work factor 12)
  const passwordHash = await security.hashPassword(password);

  // Insert user into PostgreSQL
  const res = await db.query(
    `INSERT INTO users (
       email, password_hash, full_name, phone,
       society_locality, flat_house_number, city
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, full_name, phone, society_locality, flat_house_number, city, created_at;`,
    [
      normalizedEmail,
      passwordHash,
      full_name.trim(),
      phone.trim(),
      society_locality.trim(),
      flat_house_number.trim(),
      city.trim(),
    ]
  );

  const newUser = res.rows[0];

  // Establish initial session
  const session = await createSession(newUser.id);

  return {
    user: {
      ...newUser,
      memberships: [],
    },
    session,
  };
}

/**
 * Authenticates user credentials and returns a rotated session.
 */
async function loginUser({ email, password, currentSessionId }) {
  const normalizedEmail = email.trim().toLowerCase();

  const res = await db.query(
    `SELECT id, email, password_hash, full_name, phone,
            society_locality, flat_house_number, city, created_at
     FROM users 
     WHERE email = $1;`,
    [normalizedEmail]
  );

  if (res.rowCount === 0) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const user = res.rows[0];

  // Constant-time compare password against bcrypt hash
  const isMatch = await security.comparePassword(password, user.password_hash);
  if (!isMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  // Rotate session to prevent session fixation
  const session = await rotateSession(currentSessionId, user.id);

  // Clean sensitive fields before returning
  delete user.password_hash;

  // Retrieve full user profile with memberships so client context is immediately hydrated
  const fullUser = await getUserWithMemberships(user.id);

  return {
    user: fullUser,
    session,
  };
}

/**
 * Retrieves full user profile and library memberships.
 */
async function getUserWithMemberships(userId) {
  const userRes = await db.query(
    `SELECT id, email, full_name, phone, society_locality, flat_house_number, city, created_at
     FROM users 
     WHERE id = $1;`,
    [userId]
  );

  if (userRes.rowCount === 0) {
    return null;
  }

  const user = userRes.rows[0];

  // Fetch library memberships
  const membershipsRes = await db.query(
    `SELECT lm.id AS membership_id, lm.library_id, lm.role, lm.status, lm.created_at,
            l.name AS library_name, l.slug AS library_slug, l.society_locality AS library_locality, l.city AS library_city
     FROM library_members lm
     JOIN libraries l ON l.id = lm.library_id
     WHERE lm.user_id = $1
     ORDER BY lm.created_at ASC;`,
    [userId]
  );

  return {
    ...user,
    memberships: membershipsRes.rows,
  };
}

module.exports = {
  createSession,
  deleteSession,
  rotateSession,
  registerUser,
  loginUser,
  getUserWithMemberships,
};
