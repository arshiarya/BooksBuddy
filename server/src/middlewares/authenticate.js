const db = require('../config/db');

const SESSION_COOKIE_NAME = 'booksbuddy_sid';
const CSRF_COOKIE_NAME = 'booksbuddy_csrf';

/**
 * Extracts and verifies server session from HttpOnly cookie.
 * Attaches req.user and req.session if valid.
 */
async function authenticate(req, res, next) {
  req.user = null;
  req.session = null;

  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId || typeof sessionId !== 'string') {
    return next();
  }

  try {
    const query = `
      SELECT s.id AS session_id, s.user_id, s.expires_at, s.csrf_token, s.last_accessed_at,
             u.id, u.email, u.full_name, u.phone, u.society_locality, u.flat_house_number, u.city, u.role, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP;
    `;

    const result = await db.query(query, [sessionId]);

    if (result.rowCount === 0) {
      // Session expired or deleted: clear client cookies
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
      return next();
    }

    const row = result.rows[0];

    req.user = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role || 'USER',
      isPlatformAdmin: row.role === 'PLATFORM_ADMIN',
      phone: row.phone,
      societyLocality: row.society_locality,
      flatHouseNumber: row.flat_house_number,
      city: row.city,
      createdAt: row.created_at,
    };

    req.session = {
      id: row.session_id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      csrfToken: row.csrf_token,
    };

    // Update last_accessed_at if older than 5 minutes
    const lastAccessed = new Date(row.last_accessed_at).getTime();
    if (Date.now() - lastAccessed > 5 * 60 * 1000) {
      db.query('UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1;', [row.session_id])
        .catch((err) => console.error('[SESSION ACCESS UPDATE ERROR]', err.message));
    }

    next();
  } catch (err) {
    console.error('[AUTHENTICATE MIDDLEWARE ERROR]', err);
    next(err);
  }
}

/**
 * Authorization guard: requires a valid authenticated session.
 */
function requireAuth(req, res, next) {
  if (!req.user || !req.session) {
    return res.status(401).json({
      error: {
        message: 'Authentication required. Please log in to continue.',
        statusCode: 401,
      },
    });
  }
  next();
}

module.exports = {
  authenticate,
  requireAuth,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
};
