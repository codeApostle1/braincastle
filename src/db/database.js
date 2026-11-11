/**
 * Neon/PostgreSQL connection and schema initialization.
 * The pool is shared by warm serverless instances and local development.
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure your Neon connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));

let schemaPromise;
async function initDatabase() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS collections (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS questions (
        id BIGSERIAL PRIMARY KEY,
        collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        hint TEXT,
        explanation TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS options (
        id BIGSERIAL PRIMARY KEY,
        question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL DEFAULT FALSE,
        order_index INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id BIGSERIAL PRIMARY KEY,
        collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        total_questions INTEGER NOT NULL,
        correct_answers INTEGER NOT NULL,
        score_percentage NUMERIC(5,2) NOT NULL,
        is_shuffled BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
        id BIGSERIAL PRIMARY KEY,
        attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
        question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        selected_option_id BIGINT REFERENCES options(id) ON DELETE SET NULL,
        is_correct BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
      CREATE INDEX IF NOT EXISTS idx_collections_published ON collections(is_published);
      CREATE INDEX IF NOT EXISTS idx_questions_collection ON questions(collection_id);
      CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);
      CREATE INDEX IF NOT EXISTS idx_attempts_collection ON quiz_attempts(collection_id);
      CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON quiz_attempt_answers(attempt_id);
    `).catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

module.exports = pool;
module.exports.initDatabase = initDatabase;
