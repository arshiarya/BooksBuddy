const express = require('express');
const authController = require('./auth.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { verifyCsrf } = require('../../middlewares/csrf');
const { createRateLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// Rate limiter for authentication endpoints (25 requests per 15 min window)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  message: 'Too many authentication attempts. Please try again later.',
});

// Public authentication routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/csrf-token', authController.getCsrfToken);

// Protected routes (Session required)
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, verifyCsrf, authController.logout);

router.authLimiter = authLimiter;

module.exports = router;
