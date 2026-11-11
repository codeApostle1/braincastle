/**
 * Application Configuration
 * Loads environment variables from .env with safe fallbacks
 */
require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'fallback-secret-key-change-me',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './data/quiz.db')
};
