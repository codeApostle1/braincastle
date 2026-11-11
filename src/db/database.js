/**
 * SQLite Database Connection & Initialization
 * Uses better-sqlite3 for synchronous, high-performance database operations
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite database
const db = new Database(config.dbPath, {
  // verbose: config.nodeEnv === 'development' ? console.log : null
});

// Enable Foreign Key constraints and Write-Ahead Logging for safety & performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/**
 * Initializes database schema by reading and executing schema.sql
 */
function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('✔ SQLite Database schema initialized successfully.');
}

// Auto-run schema initialization on startup
initDatabase();

module.exports = db;
