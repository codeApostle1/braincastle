const express = require('express');
const db = require('../db/database');
const router = express.Router();

function shuffleArray(items) {
  const result = [...items];
  for (let i=result.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}

router.post('/start', async (req, res) => {
  try {
    const { collectionId, questionCount, shuffle } = req.body;
    if (!collectionId) return res.status(400).json({ success: false, error: 'Collection ID is required' });
    const collectionResult = await db.query('SELECT id,title,description,cover_image FROM collections WHERE id=$1 AND is_published=TRUE', [collectionId]);
    const collection = collectionResult.rows[0];
    if (!collection) return res.status(404).json({ success: false, error: 'Quiz collection not found or is unpublished.' });
    const result = await db.query('SELECT id,collection_id,question_text,hint,order_index FROM questions WHERE collection_id=$1 ORDER BY order_index', [collectionId]);
    let questions = result.rows;
    if (!questions.length) return res.status(400).json({ success: false, error: 'This quiz has no questions available yet.' });
    const shouldShuffle = shuffle === true || shuffle === 'true' || shuffle === 1 || shuffle === '1';
    if (shouldShuffle) questions = shuffleArray(questions);
    let limit = Number.parseInt(questionCount, 10);
    if (!Number.isInteger(limit) || limit <= 0 || limit > questions.length) limit = questions.length;
    questions = questions.slice(0, limit);
    const ids = questions.map(q => q.id);
    const optionsResult = await db.query('SELECT id,question_id,option_text,order_index FROM options WHERE question_id=ANY($1::bigint[]) ORDER BY order_index', [ids]);
    const optionsByQuestion = new Map();
    for (const option of optionsResult.rows) {
      if (!optionsByQuestion.has(String(option.question_id))) optionsByQuestion.set(String(option.question_id), []);
      optionsByQuestion.get(String(option.question_id)).push(option);
    }
    const formattedQuestions = questions.map((q,index) => {
      let opts = optionsByQuestion.get(String(q.id)) || [];
      if (shouldShuffle) opts = shuffleArray(opts);
      return { id:q.id, index:index+1, questionText:q.question_text, hint:q.hint || null, options:opts.map(o=>({id:o.id,text:o.option_text})) };
    });
    res.json({ success:true, session:{collection,totalQuestions:formattedQuestions.length,isShuffled:shouldShuffle,questions:formattedQuestions} });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ success:false,error:'Failed to initialize quiz session.' });
  }
});

router.post('/submit', async (req, res) => {
  const { collectionId, answers } = req.body;
  if (!collectionId || !Array.isArray(answers) || !answers.length) return res.status(400).json({ success:false,error:'Invalid submission data.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const collectionResult = await client.query('SELECT id,title FROM collections WHERE id=$1 AND is_published=TRUE', [collectionId]);
    const collection = collectionResult.rows[0];
    if (!collection) { await client.query('ROLLBACK'); return res.status(404).json({success:false,error:'Quiz collection not found.'}); }
    const questionIds = [...new Set(answers.map(a => String(a.questionId)))];
    const questionResult = await client.query('SELECT id,question_text,hint,explanation FROM questions WHERE collection_id=$1 AND id=ANY($2::bigint[])', [collectionId, questionIds]);
    if (questionResult.rows.length !== questionIds.length) { await client.query('ROLLBACK'); return res.status(400).json({success:false,error:'Submission contains questions outside this quiz.'}); }
    const ids = questionResult.rows.map(q=>q.id);
    const optionsResult = await client.query('SELECT id,question_id,option_text,is_correct FROM options WHERE question_id=ANY($1::bigint[])', [ids]);
    const optionMap = new Map(optionsResult.rows.map(o=>[String(o.id),o]));
    let correctCount=0;
    const reviewDetails = questionResult.rows.map(q => {
      const answer=answers.find(a=>String(a.questionId)===String(q.id));
      const selected=answer?.selectedOptionId ? optionMap.get(String(answer.selectedOptionId)) : null;
      const validSelected=selected && String(selected.question_id)===String(q.id) ? selected : null;
      const correct=Boolean(validSelected?.is_correct);
      if (correct) correctCount++;
      return {questionId:q.id,questionText:q.question_text,hint:q.hint,explanation:q.explanation,selectedOptionId:validSelected?.id || null,isCorrect:correct,options:optionsResult.rows.filter(o=>String(o.question_id)===String(q.id)).map(o=>({id:o.id,text:o.option_text,isCorrect:o.is_correct}))};
    });
    const totalCount=reviewDetails.length;
    const scorePercentage=Math.round(correctCount/totalCount*100);
    const inserted=await client.query(`
      INSERT INTO quiz_attempts (collection_id,user_id,total_questions,correct_answers,score_percentage,is_shuffled)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
    `, [collectionId,req.session?.userId || null,totalCount,correctCount,scorePercentage,Boolean(req.body.isShuffled)]);
    const attemptId=inserted.rows[0].id;
    for (const item of reviewDetails) await client.query(
      'INSERT INTO quiz_attempt_answers (attempt_id,question_id,selected_option_id,is_correct) VALUES ($1,$2,$3,$4)',
      [attemptId,item.questionId,item.selectedOptionId,item.isCorrect]
    );
    await client.query('COMMIT');
    res.json({success:true,attemptId,results:{attemptId,totalQuestions:totalCount,correctAnswers:correctCount,incorrectAnswers:totalCount-correctCount,scorePercentage,isShuffled:Boolean(req.body.isShuffled),collection:{id:collection.id,title:collection.title},review:reviewDetails}});
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error evaluating quiz submission:',error);
    res.status(500).json({success:false,error:'Failed to process quiz submission.'});
  } finally { client.release(); }
});

router.get('/attempt/:id', async (req,res) => {
  try {
    const attemptResult=await db.query(`
      SELECT a.id,a.collection_id,a.total_questions,a.correct_answers,a.score_percentage,a.is_shuffled,a.completed_at,c.title AS collection_title
      FROM quiz_attempts a JOIN collections c ON c.id=a.collection_id WHERE a.id=$1
    `,[req.params.id]);
    const attempt=attemptResult.rows[0];
    if (!attempt) return res.status(404).json({success:false,error:'Attempt record not found.'});
    const answers=await db.query(`
      SELECT ans.question_id,ans.selected_option_id,ans.is_correct,q.question_text,q.hint,q.explanation
      FROM quiz_attempt_answers ans JOIN questions q ON q.id=ans.question_id WHERE ans.attempt_id=$1
    `,[req.params.id]);
    const ids=answers.rows.map(a=>a.question_id);
    const opts=ids.length ? await db.query('SELECT id,question_id,option_text,is_correct FROM options WHERE question_id=ANY($1::bigint[]) ORDER BY order_index',[ids]) : {rows:[]};
    const review=answers.rows.map(a=>({questionId:a.question_id,questionText:a.question_text,hint:a.hint,explanation:a.explanation,selectedOptionId:a.selected_option_id,isCorrect:a.is_correct,options:opts.rows.filter(o=>String(o.question_id)===String(a.question_id)).map(o=>({id:o.id,text:o.option_text,isCorrect:o.is_correct}))}));
    res.json({success:true,results:{attemptId:attempt.id,totalQuestions:attempt.total_questions,correctAnswers:attempt.correct_answers,incorrectAnswers:attempt.total_questions-attempt.correct_answers,scorePercentage:Number(attempt.score_percentage),isShuffled:attempt.is_shuffled,completedAt:attempt.completed_at,collection:{id:attempt.collection_id,title:attempt.collection_title},review}});
  } catch(error) {
    console.error('Error retrieving attempt:',error);
    res.status(500).json({success:false,error:'Failed to retrieve attempt details.'});
  }
});
module.exports=router;
