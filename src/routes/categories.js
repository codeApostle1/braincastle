/**
 * Categories Route Handler
 * Provides category listings and metadata
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');

/**
 * GET /api/categories
 * Returns list of categories with the number of published quizzes in each
 */
router.get('/', (req, res) => {
  try {
    const query = `
      SELECT 
        c.id, 
        c.name, 
        c.slug, 
        c.description, 
        c.icon,
        COUNT(col.id) AS quiz_count
      FROM categories c
      LEFT JOIN collections col ON col.category_id = c.id AND col.is_published = 1
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    const categories = db.prepare(query).all();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

module.exports = router;
