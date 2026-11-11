/**
 * BrainCastle Express application.
 * Exported as a serverless handler on Vercel; starts a listener only locally.
 */
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./src/config');
const db = require('./src/db/database');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'quiz_sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
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
app.use('/api/collections', require('./src/routes/collections'));
app.use('/api/questions', require('./src/routes/questions'));
app.use('/api/quiz', require('./src/routes/quiz'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api', (req,res)=>res.status(404).json({success:false,error:'API route not found'}));
app.use((err,req,res,next)=>{
  console.error('Unhandled Server Error:',err);
  res.status(500).json({success:false,error:config.nodeEnv==='production'?'An internal server error occurred.':err.message});
});

if (require.main === module) {
  app.listen(config.port,()=>console.log(`BrainCastle listening on port ${config.port}`));
}
module.exports = app;
