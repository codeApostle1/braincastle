/**
 * Modern Quiz Application - Main Server
 * Express.js Backend with SQLite, Server Sessions, and Static Asset Serving
 */
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./src/config');
const db = require('./src/db/database');

const app = express();

// 1. Core Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Session Configuration
app.use(session({
  name: 'quiz_sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// 3. Static Files Middleware (Serves public folder HTML, CSS, JS, assets)
app.use(express.static(path.join(__dirname, 'public')));

// 4. API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'BrainCastle',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/collections', require('./src/routes/collections'));
app.use('/api/questions', require('./src/routes/questions'));
app.use('/api/quiz', require('./src/routes/quiz'));
app.use('/api/auth', require('./src/routes/auth'));

// 5. 404 API Fallback (Express 5 compatible)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

// 6. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'production' ? 'An internal server error occurred.' : err.message
  });
});

// 7. Start Server
const server = app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`🏰 BrainCastle Application is running!`);
  console.log(`📡 URL: http://localhost:${config.port}`);
  console.log(`📂 Environment: ${config.nodeEnv}`);
  console.log(`💾 SQLite DB: ${config.dbPath}`);
  console.log(`===============================================`);
});

module.exports = { app, server };
