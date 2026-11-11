/**
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

    let query = `
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
    `;

    const params = [];

    if (search && search.trim() !== '') {
      query += ` AND (c.title LIKE ? OR c.description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY c.created_at DESC`;

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
    const query = `
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
    `;

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

    const collection = db.prepare(`
      SELECT *
      FROM collections
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    }

    const questions = db.prepare(`
      SELECT id, question_text, hint, explanation, order_index
      FROM questions
      WHERE collection_id = ?
      ORDER BY order_index ASC
    `).all(id);

    const getOptions = db.prepare(`
      SELECT id, option_text, is_correct, order_index
      FROM options
      WHERE question_id = ?
      ORDER BY order_index ASC
    `);

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

    const collection = db.prepare(`
      SELECT
        c.id, c.title, c.description, c.cover_image,
        c.created_at, c.is_published,
        u.name AS creator_name,
        (SELECT COUNT(*) FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ? AND c.is_published = 1
    `).get(id);

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

    const result = db.prepare(`
      INSERT INTO collections (user_id, title, description, cover_image, is_published)
      VALUES (?, ?, ?, ?, ?)
    `).run(
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

    const result = db.prepare(`
      UPDATE collections
      SET title = ?, description = ?, cover_image = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
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
