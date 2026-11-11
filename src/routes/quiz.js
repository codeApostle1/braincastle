/**
 * Quiz Engine Route Handler
 * Manages quiz session initialization, answer evaluation, and persistent attempt recording.
 * 
 * SECURITY PRINCIPLE:
 * Correct answer values are NEVER transmitted during quiz play.
 * Scoring and answer evaluations are strictly performed on the server.
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');

/**
 * Fisher-Yates array shuffle utility
 * @param {Array} array 
 * @returns {Array} new randomized array
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * POST /api/quiz/start
 * Initializes a quiz session: fetches questions, handles shuffle/order preservation,
 * and limits questions to the requested count.
 * Excludes all "is_correct" answer keys.
 */
router.post('/start', (req, res) => {
  try {
    const { collectionId, questionCount, shuffle } = req.body;

    if (!collectionId) {
      return res.status(400).json({ success: false, error: 'Collection ID is required' });
    }

    // Verify collection exists and is published
    const collection = db.prepare(
      'SELECT id, title, description, cover_image FROM collections WHERE id = ? AND is_published = 1'
    ).get(collectionId);

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Quiz collection not found or is unpublished.' });
    }

    // Fetch all questions for this collection
    const questionsQuery = `
      SELECT id, collection_id, question_text, hint, order_index
      FROM questions
      WHERE collection_id = ?
      ORDER BY order_index ASC
    `;
    let questions = db.prepare(questionsQuery).all(collectionId);

    if (questions.length === 0) {
      return res.status(400).json({ success: false, error: 'This quiz has no questions available yet.' });
    }

    // Shuffle questions if requested
    const shouldShuffle = Boolean(shuffle === true || shuffle === 'true' || shuffle === 1 || shuffle === '1');
    if (shouldShuffle) {
      questions = shuffleArray(questions);
    }

    // Limit to requested question count
    let requestedLimit = parseInt(questionCount, 10);
    if (isNaN(requestedLimit) || requestedLimit <= 0 || requestedLimit > questions.length) {
      requestedLimit = questions.length;
    }
    const selectedQuestions = questions.slice(0, requestedLimit);

    // Fetch options for each selected question (WITHOUT is_correct)
    const optionsStmt = db.prepare(`
      SELECT id, question_id, option_text, order_index
      FROM options
      WHERE question_id = ?
      ORDER BY order_index ASC
    `);

    const formattedQuestions = selectedQuestions.map((q, index) => {
      let opts = optionsStmt.all(q.id);
      if (shouldShuffle) {
        opts = shuffleArray(opts);
      }
      return {
        id: q.id,
        index: index + 1,
        questionText: q.question_text,
        hint: q.hint || null,
        options: opts.map(opt => ({
          id: opt.id,
          text: opt.option_text
        }))
      };
    });

    res.json({
      success: true,
      session: {
        collection,
        totalQuestions: formattedQuestions.length,
        isShuffled: shouldShuffle,
        questions: formattedQuestions
      }
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize quiz session.' });
  }
});

/**
 * POST /api/quiz/submit
 * Server-side evaluation of quiz answers, score calculation, and persistent attempt logging.
 */
router.post('/submit', (req, res) => {
  try {
    const { collectionId, totalQuestions, isShuffled, answers } = req.body;

    if (!collectionId || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, error: 'Invalid submission data.' });
    }

    // Validate collection
    const collection = db.prepare('SELECT id, title FROM collections WHERE id = ?').get(collectionId);
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Quiz collection not found.' });
    }

    const totalCount = parseInt(totalQuestions, 10) || answers.length;
    let correctCount = 0;

    // Prepared statements for review and validation
    const getQuestionStmt = db.prepare('SELECT id, question_text, hint, explanation FROM questions WHERE id = ?');
    const getOptionsStmt = db.prepare('SELECT id, option_text, is_correct FROM options WHERE question_id = ? ORDER BY order_index ASC');

    const reviewDetails = [];

    for (const ans of answers) {
      const q = getQuestionStmt.get(ans.questionId);
      if (!q) continue;

      const opts = getOptionsStmt.all(q.id);
      const selectedOption = opts.find(o => o.id === ans.selectedOptionId);
      const isCorrect = selectedOption ? Boolean(selectedOption.is_correct === 1) : false;

      if (isCorrect) {
        correctCount++;
      }

      reviewDetails.push({
        questionId: q.id,
        questionText: q.question_text,
        hint: q.hint,
        explanation: q.explanation,
        selectedOptionId: ans.selectedOptionId || null,
        isCorrect,
        options: opts.map(o => ({
          id: o.id,
          text: o.option_text,
          isCorrect: Boolean(o.is_correct === 1)
        }))
      });
    }

    const incorrectCount = Math.max(0, totalCount - correctCount);
    const scorePercentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const userId = req.session && req.session.userId ? req.session.userId : null;

    // Persist attempt inside transaction
    const insertAttempt = db.transaction(() => {
      const attemptStmt = db.prepare(`
        INSERT INTO quiz_attempts (collection_id, user_id, total_questions, correct_answers, score_percentage, is_shuffled)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const attemptResult = attemptStmt.run(
        collectionId,
        userId,
        totalCount,
        correctCount,
        scorePercentage,
        isShuffled ? 1 : 0
      );
      const attemptId = attemptResult.lastInsertRowid;

      const answerStmt = db.prepare(`
        INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option_id, is_correct)
        VALUES (?, ?, ?, ?)
      `);

      for (const item of reviewDetails) {
        answerStmt.run(attemptId, item.questionId, item.selectedOptionId, item.isCorrect ? 1 : 0);
      }

      return attemptId;
    });

    const attemptId = insertAttempt();

    res.json({
      success: true,
      attemptId,
      results: {
        attemptId,
        totalQuestions: totalCount,
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        scorePercentage,
        isShuffled: Boolean(isShuffled),
        collection: {
          id: collection.id,
          title: collection.title
        },
        review: reviewDetails
      }
    });
  } catch (error) {
    console.error('Error evaluating quiz submission:', error);
    res.status(500).json({ success: false, error: 'Failed to process quiz submission.' });
  }
});

/**
 * GET /api/quiz/attempt/:id
 * Retrieves results and answer breakdown for an existing attempt
 */
router.get('/attempt/:id', (req, res) => {
  try {
    const { id } = req.params;

    const attempt = db.prepare(`
      SELECT 
        a.id, a.collection_id, a.total_questions, a.correct_answers, 
        a.score_percentage, a.is_shuffled, a.completed_at,
        c.title AS collection_title
      FROM quiz_attempts a
      JOIN collections c ON c.id = a.collection_id
      WHERE a.id = ?
    `).get(id);

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Attempt record not found.' });
    }

    const answers = db.prepare(`
      SELECT 
        ans.question_id, ans.selected_option_id, ans.is_correct,
        q.question_text, q.hint, q.explanation
      FROM quiz_attempt_answers ans
      JOIN questions q ON q.id = ans.question_id
      WHERE ans.attempt_id = ?
    `).all(id);

    const getOptionsStmt = db.prepare('SELECT id, option_text, is_correct FROM options WHERE question_id = ?');

    const review = answers.map(ans => {
      const opts = getOptionsStmt.all(ans.question_id);
      return {
        questionId: ans.question_id,
        questionText: ans.question_text,
        hint: ans.hint,
        explanation: ans.explanation,
        selectedOptionId: ans.selected_option_id,
        isCorrect: Boolean(ans.is_correct === 1),
        options: opts.map(o => ({
          id: o.id,
          text: o.option_text,
          isCorrect: Boolean(o.is_correct === 1)
        }))
      };
    });

    res.json({
      success: true,
      results: {
        attemptId: attempt.id,
        totalQuestions: attempt.total_questions,
        correctAnswers: attempt.correct_answers,
        incorrectAnswers: attempt.total_questions - attempt.correct_answers,
        scorePercentage: attempt.score_percentage,
        isShuffled: Boolean(attempt.is_shuffled === 1),
        completedAt: attempt.completed_at,
        collection: {
          id: attempt.collection_id,
          title: attempt.collection_title
        },
        review
      }
    });
  } catch (error) {
    console.error('Error retrieving attempt:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve attempt details.' });
  }
});

module.exports = router;
