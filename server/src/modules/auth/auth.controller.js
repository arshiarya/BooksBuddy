const env = require('../../config/env');
const authService = require('./auth.service');
const { validateRegistration, validateLogin } = require('../../utils/validation');
const { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } = require('../../middlewares/authenticate');

/**
 * Sets session and CSRF cookies on the HTTP response.
 */
function setSessionCookies(res, sessionId, csrfToken, expiresAt) {
  // Session Cookie: strictly HttpOnly
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });

  // CSRF Cookie: accessible to client script to attach in X-CSRF-Token header
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

/**
 * Clears session and CSRF cookies from the client.
 */
function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

/**
 * Register a new user and initialize a session.
 */
async function register(req, res, next) {
  try {
    const validation = validateRegistration(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: {
          message: validation.errors[0],
          errors: validation.errors,
          statusCode: 400,
        },
      });
    }

    const { user, session } = await authService.registerUser(req.body);

    setSessionCookies(res, session.sessionId, session.csrfToken, session.expiresAt);

    res.status(201).json({
      message: 'Account registered successfully.',
      user,
      csrfToken: session.csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticate credentials and rotate the session.
 */
async function login(req, res, next) {
  try {
    const validation = validateLogin(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: {
          message: validation.errors[0],
          errors: validation.errors,
          statusCode: 400,
        },
      });
    }

    const currentSessionId = req.cookies?.[SESSION_COOKIE_NAME] || req.session?.id;

    const { user, session } = await authService.loginUser({
      email: req.body.email,
      password: req.body.password,
      currentSessionId,
    });

    setSessionCookies(res, session.sessionId, session.csrfToken, session.expiresAt);

    res.status(200).json({
      message: 'Logged in successfully.',
      user,
      csrfToken: session.csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Terminate the server-side session and clear client cookies.
 */
async function logout(req, res, next) {
  try {
    const sessionId = req.session?.id || req.cookies?.[SESSION_COOKIE_NAME];
    if (sessionId) {
      await authService.deleteSession(sessionId);
    }

    clearSessionCookies(res);

    res.status(200).json({
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve current authenticated user profile and memberships.
 */
async function getMe(req, res, next) {
  try {
    const userProfile = await authService.getUserWithMemberships(req.user.id);
    if (!userProfile) {
      clearSessionCookies(res);
      return res.status(401).json({
        error: {
          message: 'User account no longer exists.',
          statusCode: 401,
        },
      });
    }

    res.status(200).json({
      user: userProfile,
      csrfToken: req.session.csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Endpoint to retrieve current CSRF token.
 */
async function getCsrfToken(req, res) {
  if (req.session && req.session.csrfToken) {
    return res.status(200).json({
      csrfToken: req.session.csrfToken,
    });
  }
  res.status(200).json({
    csrfToken: null,
  });
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  getCsrfToken,
};
