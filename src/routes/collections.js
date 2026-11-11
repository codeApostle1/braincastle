const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const params = search ? [`%${search}%`] : [];
    const { rows } = await db.query(`
      SELECT c.id, c.title, c.description, c.cover_image, c.created_at, u.name AS creator_name,
        (SELECT COUNT(*)::int FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c JOIN users u ON u.id = c.user_id
      WHERE c.is_published = TRUE AND ($1::text IS NULL OR c.title ILIKE $1 OR c.description ILIKE $1)
      ORDER BY c.created_at DESC
    `, [params[0] || null]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch collections' });
  }
});

router.get('/creator/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.title, c.description, c.cover_image, c.is_published, c.created_at, c.updated_at,
        (SELECT COUNT(*)::int FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c WHERE c.user_id = $1 ORDER BY c.created_at DESC
    `, [req.session.userId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching creator collections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch your collections.' });
  }
});

router.get('/:id/manage', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM collections WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
    const collection = rows[0];
    if (!collection) return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    const questions = await db.query('SELECT id, question_text, hint, explanation, order_index FROM questions WHERE collection_id = $1 ORDER BY order_index', [req.params.id]);
    const ids = questions.rows.map(q => q.id);
    const options = ids.length ? await db.query('SELECT id, question_id, option_text, is_correct, order_index FROM options WHERE question_id = ANY($1::bigint[]) ORDER BY order_index', [ids]) : { rows: [] };
    const byQuestion = new Map();
    for (const o of options.rows) {
      if (!byQuestion.has(String(o.question_id))) byQuestion.set(String(o.question_id), []);
      byQuestion.get(String(o.question_id)).push({ id: o.id, text: o.option_text, isCorrect: o.is_correct });
    }
    res.json({ success: true, collection: { ...collection, questions: questions.rows.map(q => ({ ...q, options: byQuestion.get(String(q.id)) || [] })) } });
  } catch (error) {
    console.error('Error loading collection editor:', error);
    res.status(500).json({ success: false, error: 'Failed to load collection for editing.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.title, c.description, c.cover_image, c.created_at, c.is_published, u.name AS creator_name,
        (SELECT COUNT(*)::int FROM questions q WHERE q.collection_id = c.id) AS question_count
      FROM collections c JOIN users u ON u.id = c.user_id
      WHERE c.id = $1 AND c.is_published = TRUE
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Quiz collection not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching collection details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch collection details' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, coverImage, isPublished } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Collection title is required.' });
    const defaultCover = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80';
    const { rows } = await db.query(`
      INSERT INTO collections (user_id, title, description, cover_image, is_published)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [req.session.userId, title.trim(), description?.trim() || '', coverImage?.trim() || defaultCover, Boolean(isPublished)]);
    res.status(201).json({ success: true, message: 'Quiz collection created successfully!', collection: rows[0] });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ success: false, error: 'Failed to create collection.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, description, coverImage, isPublished } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Title is required.' });
    const result = await db.query(`
      UPDATE collections SET title=$1, description=$2, cover_image=$3, is_published=$4, updated_at=CURRENT_TIMESTAMP
      WHERE id=$5 AND user_id=$6 RETURNING id
    `, [title.trim(), description?.trim() || '', coverImage?.trim() || '', Boolean(isPublished), req.params.id, req.session.userId]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    res.json({ success: true, message: 'Collection updated successfully.' });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ success: false, error: 'Failed to update collection.' });
  }
});

router.patch('/:id/toggle-publish', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE collections SET is_published = NOT is_published, updated_at=CURRENT_TIMESTAMP
      WHERE id=$1 AND user_id=$2 RETURNING is_published
    `, [req.params.id, req.session.userId]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    res.json({ success: true, isPublished: rows[0].is_published, message: rows[0].is_published ? 'Quiz published to public homepage!' : 'Quiz unpublished and saved as draft.' });
  } catch (error) {
    console.error('Error toggling publish status:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle publication status.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM collections WHERE id=$1 AND user_id=$2', [req.params.id, req.session.userId]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Collection not found or access denied.' });
    res.json({ success: true, message: 'Collection deleted successfully.' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collection.' });
  }
});
module.exports = router;
