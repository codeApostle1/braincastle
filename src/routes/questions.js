const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const isCorrect = value => value === true || value === 1 || value === '1';
function validateQuestion(questionText, options) {
  if (!questionText?.trim()) return 'Question text is required.';
  if (!Array.isArray(options) || options.length < 2) return 'At least two options are required.';
  if (options.some(o => !o.text?.trim())) return 'Every option must contain text.';
  if (!options.some(o => isCorrect(o.isCorrect))) return 'Please mark one option as the correct answer.';
  return null;
}

router.post('/', requireAuth, async (req, res) => {
  const { collectionId, questionText, hint, explanation, options } = req.body;
  if (!collectionId) return res.status(400).json({ success: false, error: 'Collection ID is required.' });
  const validationError = validateQuestion(questionText, options);
  if (validationError) return res.status(400).json({ success: false, error: validationError });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query('SELECT id FROM collections WHERE id=$1 AND user_id=$2 FOR UPDATE', [collectionId, req.session.userId]);
    if (!owned.rowCount) { await client.query('ROLLBACK'); return res.status(403).json({ success: false, error: 'You do not have permission to add questions to this collection.' }); }
    const order = await client.query('SELECT COALESCE(MAX(order_index),0)+1 AS next FROM questions WHERE collection_id=$1', [collectionId]);
    const inserted = await client.query(`
      INSERT INTO questions (collection_id, question_text, hint, explanation, order_index)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [collectionId, questionText.trim(), hint?.trim() || null, explanation?.trim() || null, order.rows[0].next]);
    const questionId = inserted.rows[0].id;
    for (let i=0; i<options.length; i++) await client.query(
      'INSERT INTO options (question_id, option_text, is_correct, order_index) VALUES ($1,$2,$3,$4)',
      [questionId, options[i].text.trim(), isCorrect(options[i].isCorrect), i+1]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Question added successfully!', questionId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding question:', error);
    res.status(500).json({ success: false, error: 'Failed to add question.' });
  } finally { client.release(); }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { questionText, hint, explanation, options } = req.body;
  const validationError = validateQuestion(questionText, options);
  if (validationError) return res.status(400).json({ success: false, error: validationError });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query(`
      SELECT q.id FROM questions q JOIN collections c ON c.id=q.collection_id
      WHERE q.id=$1 AND c.user_id=$2 FOR UPDATE OF q
    `, [req.params.id, req.session.userId]);
    if (!owned.rowCount) { await client.query('ROLLBACK'); return res.status(403).json({ success: false, error: 'Question not found or access denied.' }); }
    await client.query('UPDATE questions SET question_text=$1, hint=$2, explanation=$3 WHERE id=$4', [questionText.trim(), hint?.trim() || null, explanation?.trim() || null, req.params.id]);
    await client.query('DELETE FROM options WHERE question_id=$1', [req.params.id]);
    for (let i=0; i<options.length; i++) await client.query(
      'INSERT INTO options (question_id, option_text, is_correct, order_index) VALUES ($1,$2,$3,$4)',
      [req.params.id, options[i].text.trim(), isCorrect(options[i].isCorrect), i+1]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Question updated successfully!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating question:', error);
    res.status(500).json({ success: false, error: 'Failed to update question.' });
  } finally { client.release(); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM questions q USING collections c
      WHERE q.collection_id=c.id AND q.id=$1 AND c.user_id=$2
    `, [req.params.id, req.session.userId]);
    if (!result.rowCount) return res.status(403).json({ success: false, error: 'Question not found or access denied.' });
    res.json({ success: true, message: 'Question deleted successfully.' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ success: false, error: 'Failed to delete question.' });
  }
});
module.exports = router;
