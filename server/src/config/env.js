const dotenv = require('dotenv');
const path = require('path');

// Load .env from root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/booksbuddy',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_session_secret_change_in_production',
  SESSION_MAX_AGE_DAYS: parseInt(process.env.SESSION_MAX_AGE_DAYS, 10) || 14,
  isProduction: process.env.NODE_ENV === 'production',
};

// Basic validation warnings in development
if (env.isProduction && env.SESSION_SECRET === 'dev_session_secret_change_in_production') {
  console.warn('[SECURITY WARNING] Running in production with default SESSION_SECRET!');
}

module.exports = env;
