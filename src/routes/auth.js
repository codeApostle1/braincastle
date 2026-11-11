const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const router = express.Router();

router.get('/me', async (req, res) => {
  try {
    if (!req.session?.userId) return res.json({ success: true, user: null });
    const { rows } = await db.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [req.session.userId]);
    res.json({ success: true, user: rows[0] || null });
  } catch (error) {
    console.error('Auth session lookup failed:', error);
    res.status(500).json({ success: false, error: 'Could not load session.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, name } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ success: false, error: 'Email address is required.' });
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    if (!password || password.length < 6) return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    if (password !== confirmPassword) return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    const cleanName = name?.trim() || cleanEmail.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, email, name',
      [cleanEmail, passwordHash, cleanName]
    );
    if (!rows[0]) return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    req.session.userId = rows[0].id;
    req.session.user = rows[0];
    req.session.save(error => {
      if (error) return res.status(500).json({ success: false, error: 'Could not start your session.' });
      res.status(201).json({ success: true, message: 'Account created successfully!', user: rows[0] });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed due to a server error.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password are required.' });
    const { rows } = await db.query('SELECT id, email, password_hash, name FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    req.session.cookie.maxAge = rememberMe ? 30 * 86400000 : 86400000;
    req.session.userId = user.id;
    req.session.user = { id: user.id, email: user.email, name: user.name };
    req.session.save(error => {
      if (error) return res.status(500).json({ success: false, error: 'Could not start your session.' });
      res.json({ success: true, message: 'Logged in successfully', user: req.session.user });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ success: false, error: 'Could not log out' });
    res.clearCookie('quiz_sid', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  });
});
module.exports = router;
