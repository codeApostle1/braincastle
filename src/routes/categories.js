const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.name, c.slug, c.description, c.icon, COUNT(col.id)::int AS quiz_count
      FROM categories c
      LEFT JOIN collections col ON col.category_id = c.id AND col.is_published = TRUE
      GROUP BY c.id ORDER BY c.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});
module.exports = router;
