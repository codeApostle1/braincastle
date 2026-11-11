/**
 * BrainCastle Express application.
 * Exported as a serverless handler on Vercel; starts a listener only locally.
 */
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const config = require('./src/config');
const db = require('./src/db/database');

const app = express();

app.set('trust proxy', 1);

// Baseline browser security headers. Existing inline scripts/styles mean a strict CSP
// is deferred until those assets can be moved into separate files.
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Per-instance abuse throttling, combined with persistent database limits.
const requestBuckets = new Map();
function throttle({ limit, windowMs, keyPrefix }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyPrefix + ':' + (req.ip || req.socket.remoteAddress || 'unknown');
    let bucket = requestBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    requestBuckets.set(key, bucket);
    if (requestBuckets.size > 5000) {
      for (const [k, value] of requestBuckets) if (now >= value.resetAt) requestBuckets.delete(k);
    }
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, error: 'Too many requests. Please wait and try again.' });
    }
    next();
  };
}
const authThrottle = throttle({ limit: 12, windowMs: 15 * 60 * 1000, keyPrefix: 'auth' });
const commentThrottle = throttle({ limit: 12, windowMs: 60 * 60 * 1000, keyPrefix: 'comments' });

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'quiz_sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new PgSession({ pool: db, tableName: 'user_sessions', createTableIfMissing: true }),
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(async (req, res, next) => {
  try { await db.initDatabase(); next(); }
  catch (error) { next(error); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', async (req,res) => {
  try { await db.query('SELECT 1'); res.json({status:'online',appName:'BrainCastle',timestamp:new Date().toISOString(),environment:config.nodeEnv,database:'connected'}); }
  catch (error) { res.status(503).json({status:'error',database:'unavailable'}); }
});
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/collections', (req, res, next) => {
  if (req.method === 'POST' && /\\/comments$/.test(req.path)) return commentThrottle(req, res, next);
  next();
}, require('./src/routes/collections'));
app.use('/api/questions', require('./src/routes/questions'));
app.use('/api/quiz', require('./src/routes/quiz'));
app.use('/api/auth', (req, res, next) => {
  if (req.method === 'POST' && ['/login','/register','/forgot-password','/reset-password'].includes(req.path)) return authThrottle(req, res, next);
  next();
}, require('./src/routes/auth'));
app.use('/api', (req,res)=>res.status(404).json({success:false,error:'API route not found'}));
app.use((err,req,res,next)=>{
  console.error('Unhandled Server Error:',err);
  res.status(500).json({success:false,error:config.nodeEnv==='production'?'An internal server error occurred.':err.message});
});

if (require.main === module) {
  app.listen(config.port,()=>console.log(`BrainCastle listening on port ${config.port}`));
}
module.exports = app;
