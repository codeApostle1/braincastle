const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const router = express.Router();
const crypto = require('crypto');

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


router.post('/forgot-password', async (req, res) => {
  const generic = 'If an account exists for that email, a password reset link will be sent shortly.';
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ success: true, message: generic });
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_BASE_URL) {
      console.error('Password reset email is not configured: set RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL.');
      return res.json({ success: true, message: generic });
    }
    const { rows } = await db.query('SELECT id,email FROM users WHERE email=$1', [email]);
    if (!rows[0]) return res.json({ success: true, message: generic });
    const user = rows[0];
    const recent = await db.query("SELECT COUNT(*)::int AS count FROM password_reset_tokens WHERE user_id=$1 AND created_at > NOW() - INTERVAL '1 hour'", [user.id]);
    if (recent.rows[0].count >= 3) return res.json({ success: true, message: generic });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await db.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
    await db.query("INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,NOW()+INTERVAL '30 minutes')", [user.id,tokenHash]);
    const baseUrl = process.env.APP_BASE_URL;
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const resetUrl = normalizedBaseUrl + '/reset-password.html?token=' + rawToken;
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [user.email],
        subject: 'Reset your BrainCastle password',
        html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Reset your BrainCastle password</h2><p>We received a request to reset your password. This link expires in 30 minutes and can only be used once.</p><p><a href="' + resetUrl + '" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px">Create a new password</a></p><p>If you did not request this, you can ignore this email. Your password will remain unchanged.</p></div>'
      })
    });
    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      console.error('Password reset email provider error:', detail.slice(0, 500));
      return res.status(502).json({ success: false, error: 'We could not send the reset email right now. Please try again later.' });
    }
    res.json({ success: true, message: generic });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Could not process the password reset request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 10 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Use a valid reset link and a password of at least 10 characters.' });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await client.query('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [tokenHash]);
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Please request a new one.' }); }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, rows[0].user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [rows[0].user_id]);
    await client.query("DELETE FROM user_sessions WHERE sess->>'userId'=$1", [String(rows[0].user_id)]).catch(() => {});
    await client.query('COMMIT');
    res.json({ success: true, message: 'Your password has been updated. You can now sign in with your new password.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Could not update your password.' });
  } finally { client.release(); }
});


router.post('/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ success: false, error: 'Could not log out' });
    res.clearCookie('quiz_sid', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  });
});
module.exports = router;
