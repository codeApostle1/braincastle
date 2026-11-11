/**
 * Question Management Route Handler
 * Allows creators to add, edit, and delete questions and options for their collections
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

/**
 * Helper: Verifies that a question belongs to a collection owned by the user
 */
function verifyQuestionOwnership(questionId, userId) {
  const query = `
    SELECT q.id, q.collection_id
    FROM questions q
    JOIN collections c ON c.id = q.collection_id
    WHERE q.id = ? AND c.user_id = ?
  `;
  return db.prepare(query).get(questionId, userId);
}

/**
 * POST /api/questions
 * Adds a new question with multiple-choice options to a collection
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { collectionId, questionText, hint, explanation, options } = req.body;

    if (!collectionId) {
      return res.status(400).json({ success: false, error: 'Collection ID is required.' });
    }

    // Verify creator ownership of collection
    const collection = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(collectionId, req.session.userId);
    if (!collection) {
      return res.status(403).json({ success: false, error: 'You do not have permission to add questions to this collection.' });
    }

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ success: false, error: 'Question text is required.' });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, error: 'At least two options are required.' });
    }

    // Validate that at least one option is marked correct
    const hasCorrect = options.some(o => o.isCorrect === true || o.isCorrect === 1 || o.isCorrect === '1');
    if (!hasCorrect) {
      return res.status(400).json({ success: false, error: 'Please mark one option as the correct answer.' });
    }

    // Insert question and options atomically
    const insertTransaction = db.transaction(() => {
      // Find current max order index
      const maxOrder = db.prepare('SELECT MAX(order_index) as maxOrder FROM questions WHERE collection_id = ?').get(collectionId).maxOrder || 0;

      const insertQ = db.prepare(`
        INSERT INTO questions (collection_id, question_text, hint, explanation, order_index)
        VALUES (?, ?, ?, ?, ?)
      `);
      const qResult = insertQ.run(collectionId, questionText.trim(), hint ? hint.trim() : null, explanation ? explanation.trim() : null, maxOrder + 1);
      const questionId = qResult.lastInsertRowid;

      const insertOpt = db.prepare(`
        INSERT INTO options (question_id, option_text, is_correct, order_index)
        VALUES (?, ?, ?, ?)
      `);

      options.forEach((opt, idx) => {
        const isCorr = (opt.isCorrect === true || opt.isCorrect === 1 || opt.isCorrect === '1') ? 1 : 0;
        insertOpt.run(questionId, (opt.text || '').trim(), isCorr, idx + 1);
      });

      return questionId;
    });

    const questionId = insertTransaction();

    res.status(201).json({
      success: true,
      message: 'Question added successfully!',
      questionId
    });

  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ success: false, error: 'Failed to add question.' });
  }
});

/**
 * PUT /api/questions/:id
 * Updates an existing question and its options
 */
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { questionText, hint, explanation, options } = req.body;

    const owned = verifyQuestionOwnership(id, req.session.userId);
    if (!owned) {
      return res.status(403).json({ success: false, error: 'Question not found or access denied.' });
    }

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ success: false, error: 'Question text cannot be empty.' });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, error: 'At least two options are required.' });
    }

    const hasCorrect = options.some(o => o.isCorrect === true || o.isCorrect === 1 || o.isCorrect === '1');
    if (!hasCorrect) {
      return res.status(400).json({ success: false, error: 'Please mark one option as the correct answer.' });
    }

    const updateTransaction = db.transaction(() => {
      // Update question text, hint, explanation
      db.prepare(`
        UPDATE questions
        SET question_text = ?, hint = ?, explanation = ?
        WHERE id = ?
      `).run(questionText.trim(), hint ? hint.trim() : null, explanation ? explanation.trim() : null, id);

      // Recreate options cleanly
      db.prepare('DELETE FROM options WHERE question_id = ?').run(id);

      const insertOpt = db.prepare(`
        INSERT INTO options (question_id, option_text, is_correct, order_index)
        VALUES (?, ?, ?, ?)
      `);

      options.forEach((opt, idx) => {
        const isCorr = (opt.isCorrect === true || opt.isCorrect === 1 || opt.isCorrect === '1') ? 1 : 0;
        insertOpt.run(id, (opt.text || '').trim(), isCorr, idx + 1);
      });
    });

    updateTransaction();

    res.json({
      success: true,
      message: 'Question updated successfully!'
    });

  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ success: false, error: 'Failed to update question.' });
  }
});

/**
 * DELETE /api/questions/:id
 * Deletes a question and its options
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const owned = verifyQuestionOwnership(id, req.session.userId);
    if (!owned) {
      return res.status(403).json({ success: false, error: 'Question not found or access denied.' });
    }

    db.prepare('DELETE FROM questions WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Question deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ success: false, error: 'Failed to delete question.' });
  }
});

module.exports = router;
