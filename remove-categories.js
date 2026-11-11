/**
 * remove-categories.js
 * Fully removes category dependency from BrainCastle:
 *  1. Patches schema.sql  — make category_id optional / nullable
 *  2. Rewrites collections.js route — no more category JOINs or validation
 *  3. Rewrites quiz.js route — removes category JOIN in /start
 *  4. Patches admin.js — removes loadCategories call and availableCategories usage
 *  5. Migrates existing DB rows so category_id is no longer required
 */
const fs   = require('fs');
const path = require('path');

const BASE = __dirname;

// ─── 1. SCHEMA ────────────────────────────────────────────────────────────────
const schemaPath = path.join(BASE, 'src/db/schema.sql');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Make category_id nullable and remove FK constraint
schema = schema.replace(
  `-- 3. Quiz Collections Table (Owned by a user, grouped under a category)\nCREATE TABLE IF NOT EXISTS collections (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  user_id INTEGER NOT NULL,\n  category_id INTEGER NOT NULL,\n  title TEXT NOT NULL,\n  description TEXT,\n  cover_image TEXT,\n  is_published INTEGER NOT NULL DEFAULT 0, -- 0 = Draft, 1 = Published\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,\n  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT\n);`,
  `-- 3. Quiz Collections Table (Owned by a user)\nCREATE TABLE IF NOT EXISTS collections (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  user_id INTEGER NOT NULL,\n  title TEXT NOT NULL,\n  description TEXT,\n  cover_image TEXT,\n  is_published INTEGER NOT NULL DEFAULT 0, -- 0 = Draft, 1 = Published\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE\n);`
);

// Remove category index
schema = schema.replace(
  `CREATE INDEX IF NOT EXISTS idx_collections_category ON collections(category_id);\n`,
  ``
);

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('✔ schema.sql patched — category_id removed from collections table');

// ─── 2. COLLECTIONS ROUTE ─────────────────────────────────────────────────────
const newCollections = `/**
 * Collections Route Handler
 * Manages public discovery and creator collection management with ownership verification.
 * Categories have been removed from this application.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/collections
 * Public route — lists all published quiz collections.
 * Supports optional ?search= query param.
 */
router.get('/', (req, res) => {
  try {
    const { search } = req.query;

    let query = \`
      SELECT
        c.id,
        c.title,
        c.description,
        c.cover_image,
        c.created_at,
        u.name AS creator_name,
        (SELECT COUNT(*) FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c
      JOIN users u ON u.id = c.user_id
      WHERE c.is_published = 1
    \`;

    const params = [];

    if (search && search.trim() !== '') {
      query += \` AND (c.title LIKE ? OR c.description LIKE ?)\`;
      const term = \`%\${search.trim()}%\`;
      params.push(term, term);
    }

    query += \` ORDER BY c.created_at DESC\`;

    const collections = db.prepare(query).all(...params);
    res.json({ success: true, data: collections });

  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch collections' });
  }
});

/**
 * GET /api/collections/creator/mine
 * Protected — returns all collections owned by the logged-in creator.
 */
router.get('/creator/mine', requireAuth, (req, res) => {
  try {
    const query = \`
      SELECT
        c.id,
        c.title,
        c.description,
        c.cover_image,
        c.is_published,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    \`;

    const collections = db.prepare(query).all(req.session.userId);
    res.json({ success: true, data: collections });

  } catch (error) {
    console.error('Error fetching creator collections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch your collections.' });
  }
});

/**
 * GET /api/collections/:id/manage
 * Protected — returns a single collection with questions and options for the creator editor.
 */
router.get('/:id/manage', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const collection = db.prepare(\`
      SELECT *
      FROM collections
      WHERE id = ? AND user_id = ?
    \`).get(id, req.session.userId);

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    }

    const questions = db.prepare(\`
      SELECT id, question_text, hint, explanation, order_index
      FROM questions
      WHERE collection_id = ?
      ORDER BY order_index ASC
    \`).all(id);

    const getOptions = db.prepare(\`
      SELECT id, option_text, is_correct, order_index
      FROM options
      WHERE question_id = ?
      ORDER BY order_index ASC
    \`);

    const questionsWithOptions = questions.map(q => ({
      ...q,
      options: getOptions.all(q.id).map(o => ({
        id: o.id,
        text: o.option_text,
        isCorrect: o.is_correct === 1
      }))
    }));

    res.json({
      success: true,
      collection: { ...collection, questions: questionsWithOptions }
    });

  } catch (error) {
    console.error('Error fetching collection management data:', error);
    res.status(500).json({ success: false, error: 'Failed to load collection for editing.' });
  }
});

/**
 * GET /api/collections/:id
 * Public — details of a single published collection.
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const collection = db.prepare(\`
      SELECT
        c.id, c.title, c.description, c.cover_image,
        c.created_at, c.is_published,
        u.name AS creator_name,
        (SELECT COUNT(*) FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ? AND c.is_published = 1
    \`).get(id);

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Quiz collection not found' });
    }

    res.json({ success: true, data: collection });

  } catch (error) {
    console.error('Error fetching collection details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch collection details' });
  }
});

/**
 * POST /api/collections
 * Protected — creates a new collection.
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { title, description, coverImage, isPublished } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Collection title is required.' });
    }

    const defaultCover = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80';

    const result = db.prepare(\`
      INSERT INTO collections (user_id, title, description, cover_image, is_published)
      VALUES (?, ?, ?, ?, ?)
    \`).run(
      req.session.userId,
      title.trim(),
      description ? description.trim() : '',
      coverImage && coverImage.trim() ? coverImage.trim() : defaultCover,
      isPublished ? 1 : 0
    );

    const newCollection = db.prepare('SELECT * FROM collections WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Quiz collection created successfully!',
      collection: newCollection
    });

  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ success: false, error: 'Failed to create collection.' });
  }
});

/**
 * PUT /api/collections/:id
 * Protected — updates a collection (verifies ownership).
 */
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, coverImage, isPublished } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    const result = db.prepare(\`
      UPDATE collections
      SET title = ?, description = ?, cover_image = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    \`).run(
      title.trim(),
      description ? description.trim() : '',
      coverImage ? coverImage.trim() : '',
      isPublished ? 1 : 0,
      id,
      req.session.userId
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    }

    res.json({ success: true, message: 'Collection updated successfully.' });

  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ success: false, error: 'Failed to update collection.' });
  }
});

/**
 * PATCH /api/collections/:id/toggle-publish
 * Protected — toggles published state.
 */
router.patch('/:id/toggle-publish', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const collection = db.prepare(
      'SELECT id, is_published FROM collections WHERE id = ? AND user_id = ?'
    ).get(id, req.session.userId);

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    }

    const newStatus = collection.is_published === 1 ? 0 : 1;
    db.prepare(
      'UPDATE collections SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newStatus, id);

    res.json({
      success: true,
      isPublished: newStatus,
      message: newStatus === 1 ? 'Quiz published to public homepage!' : 'Quiz unpublished and saved as draft.'
    });

  } catch (error) {
    console.error('Error toggling publish status:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle publication status.' });
  }
});

/**
 * DELETE /api/collections/:id
 * Protected — deletes a collection (cascades to questions & options).
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare(
      'DELETE FROM collections WHERE id = ? AND user_id = ?'
    ).run(id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    }

    res.json({ success: true, message: 'Collection deleted successfully.' });

  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collection.' });
  }
});

module.exports = router;
`;

fs.writeFileSync(path.join(BASE, 'src/routes/collections.js'), newCollections, 'utf8');
console.log('✔ collections.js rewritten — all category JOINs removed');

// ─── 3. QUIZ ROUTE — remove category JOIN in /start ───────────────────────────
let quiz = fs.readFileSync(path.join(BASE, 'src/routes/quiz.js'), 'utf8');

quiz = quiz.replace(
  `    // Verify collection exists and is published\n    const collectionQuery = \`\n      SELECT c.id, c.title, c.description, c.cover_image, cat.name AS category_name\n      FROM collections c\n      JOIN categories cat ON cat.id = c.category_id\n      WHERE c.id = ? AND c.is_published = 1\n    \`;\n    const collection = db.prepare(collectionQuery).get(collectionId);`,
  `    // Verify collection exists and is published\n    const collection = db.prepare(\n      'SELECT id, title, description, cover_image FROM collections WHERE id = ? AND is_published = 1'\n    ).get(collectionId);`
);

fs.writeFileSync(path.join(BASE, 'src/routes/quiz.js'), quiz, 'utf8');
console.log('✔ quiz.js patched — category JOIN removed from /start');

// ─── 4. ADMIN.JS — remove loadCategories call and availableCategories ─────────
let admin = fs.readFileSync(path.join(BASE, 'public/js/admin.js'), 'utf8');

// Remove availableCategories variable
admin = admin.replace(
  `  let availableCategories = [];\n`,
  ``
);

// Remove loadCategories() call in checkAuth
admin = admin.replace(
  `      await loadCategories();\n      await loadCreatorCollections();`,
  `      await loadCreatorCollections();`
);

// Remove the entire loadCategories function
const loadCatStart = admin.indexOf("  /**\n   * 2. Load Categories for Dropdowns\n   */\n  async function loadCategories()");
const loadCatEnd   = admin.indexOf("\n\n  /**\n   * 3.", loadCatStart);
if (loadCatStart !== -1 && loadCatEnd !== -1) {
  admin = admin.substring(0, loadCatStart) + admin.substring(loadCatEnd);
  console.log('✔ admin.js — loadCategories() function removed');
} else {
  console.log('⚠ admin.js — could not locate loadCategories function block (may already be removed)');
}

// Remove category_name display from renderCollectionsList card
admin = admin.replace(
  /\s*<span style="font-size: 0\.72rem.*?category_icon.*?category_name.*?<\/span>/gs,
  ''
);

fs.writeFileSync(path.join(BASE, 'public/js/admin.js'), admin, 'utf8');
console.log('✔ admin.js patched — category references removed');

// ─── 5. MIGRATE DATABASE — drop category_id column if exists ─────────────────
// SQLite doesn't support DROP COLUMN before 3.35, so we recreate the table
try {
  const Database = require('better-sqlite3');
  const db = new Database(path.join(BASE, 'data/quiz.db'));

  db.pragma('foreign_keys = OFF');

  // Check if category_id column still exists
  const cols = db.prepare("PRAGMA table_info(collections)").all().map(c => c.name);
  if (cols.includes('category_id')) {
    db.exec(`
      BEGIN TRANSACTION;

      -- Create new collections table without category_id
      CREATE TABLE collections_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        title       TEXT    NOT NULL,
        description TEXT,
        cover_image TEXT,
        is_published INTEGER NOT NULL DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Copy existing data (drop category_id)
      INSERT INTO collections_new (id, user_id, title, description, cover_image, is_published, created_at, updated_at)
      SELECT id, user_id, title, description, cover_image, is_published, created_at, updated_at
      FROM collections;

      -- Swap tables
      DROP TABLE collections;
      ALTER TABLE collections_new RENAME TO collections;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_collections_user      ON collections(user_id);
      CREATE INDEX IF NOT EXISTS idx_collections_published ON collections(is_published);

      COMMIT;
    `);
    console.log('✔ database migrated — category_id column removed from collections table');
  } else {
    console.log('✔ database — category_id column already absent, no migration needed');
  }

  db.pragma('foreign_keys = ON');
  db.close();

} catch (err) {
  console.error('⚠ Database migration error:', err.message);
  console.log('  You may need to delete data/quiz.db and restart the server to regenerate the schema.');
}

console.log('\n✅ All category references removed. Restart your server for changes to take effect.');
