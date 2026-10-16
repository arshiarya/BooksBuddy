const security = require('../utils/security');

/**
 * CSRF Protection Middleware for cookie-authenticated state-changing requests.
 * Enforces valid X-CSRF-Token header on POST, PUT, PATCH, DELETE for active sessions.
 */
function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // If the request has an active session, strictly verify CSRF token
  if (req.session && req.session.csrfToken) {
    const clientToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    
    if (!clientToken || !security.safeCompare(clientToken, req.session.csrfToken)) {
      return res.status(403).json({
        error: {
          message: 'Invalid or missing CSRF token.',
          statusCode: 403,
        },
      });
    }
  }

  next();
}

module.exports = {
  verifyCsrf,
};
