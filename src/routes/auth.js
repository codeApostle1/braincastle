/**
 * Authentication Route Handler
 * Implements registration, login, logout, and session inspection using bcryptjs and express-session
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');

/**
 * GET /api/auth/me
 * Returns current authenticated user from session or null
 */
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      return res.json({ success: true, user });
    }
  }
  res.json({ success: true, user: null });
});

/**
 * POST /api/auth/register
 * Creates a new creator account and starts a session
 */
router.post('/register', (req, res) => {
  try {
    const { email, password, confirmPassword, name } = req.body;

    // 1. Validation
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0];

    // 2. Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    // 3. Hash password and insert
    const passwordHash = bcrypt.hashSync(password, 10);
    const insertStmt = db.prepare(`
      INSERT INTO users (email, password_hash, name)
      VALUES (?, ?, ?)
    `);
    const result = insertStmt.run(cleanEmail, passwordHash, cleanName);
    const userId = result.lastInsertRowid;

    // 4. Set session
    req.session.userId = userId;
    req.session.user = {
      id: userId,
      email: cleanEmail,
      name: cleanName
    };

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: req.session.user
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed due to a server error.' });
  }
});

/**
 * POST /api/auth/login
 * Validates credentials and initializes session
 */
router.post('/login', (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Configure session duration for rememberMe
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24; // 1 day
    }

    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    res.json({
      success: true,
      message: 'Logged in successfully',
      user: req.session.user
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
  }
});

/**
 * POST /api/auth/logout
 * Destroys server-side session and clears cookie
 */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Could not log out' });
    }
    res.clearCookie('quiz_sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;
