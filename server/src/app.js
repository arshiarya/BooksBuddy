const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration supporting credentials (cookies)
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token'],
  })
);

// Body and cookie parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const { authenticate } = require('./middlewares/authenticate');
const { verifyCsrf } = require('./middlewares/csrf');
const authRoutes = require('./modules/auth/auth.routes');
const libraryRoutes = require('./modules/libraries/libraries.routes');
const bookRoutes = require('./modules/books/books.routes');

// Global authentication and CSRF middlewares
app.use(authenticate);
app.use(verifyCsrf);

// Mount domain routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/libraries', libraryRoutes);
app.use('/api/v1/books', bookRoutes);

const db = require('./config/db');

// Phase 1 & 2 Health-Check Endpoint with Database Probe
app.get('/health', async (req, res) => {
  const dbHealth = await db.healthCheck();
  const isHealthy = dbHealth.ok;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'booksbuddy-server',
    environment: env.NODE_ENV,
    database: dbHealth,
  });
});

// API Root Info
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    name: 'BooksBuddy API',
    version: '1.0.0',
    description: 'Community-based virtual library platform API',
  });
});

// 404 Catch-all handler
app.use((req, res, next) => {
  res.status(404).json({
    error: {
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
    },
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    console.error('[SERVER ERROR]', err);
  }
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      statusCode,
      ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
});

module.exports = app;
