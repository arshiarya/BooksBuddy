/**
 * In-memory sliding-window rate limiter middleware.
 * Zero external dependencies, suitable for modular monolith.
 */

function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes default
  maxRequests = 20,          // 20 requests per window
  message = 'Too many requests, please try again later.',
} = {}) {
  const ipHits = new Map();

  // Periodic cleanup of stale IP entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipHits.entries()) {
      if (now - record.startTime > windowMs) {
        ipHits.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it does not block Node process exit in tests
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware = (req, res, next) => {
    // In test environment, allow bypassing rate limiting if header is set or configured
    if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let record = ipHits.get(ip);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      ipHits.set(ip, record);
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.startTime + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: {
          message,
          statusCode: 429,
          retryAfterSeconds,
        },
      });
    }

    next();
  };

  middleware.reset = () => {
    ipHits.clear();
  };

  return middleware;
}

// Pre-configured limiters for critical application domains
const pinLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  message: 'Too many PIN verification attempts. Please try again later.',
});

const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Search rate limit exceeded. Please slow down your requests.',
});

const borrowLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: 'Too many borrow requests. Please try again later.',
});

module.exports = {
  createRateLimiter,
  pinLimiter,
  searchLimiter,
  borrowLimiter,
};

