const express = require('express');
const router = express.Router();
const db = require('../db/init');

// Protected: list feedback (mounted after requireAuth in server.js).
router.get('/', (req, res) => {
  const { language, category, status } = req.query;
  let sql = 'SELECT * FROM cafeteria_feedback WHERE 1=1';
  const params = [];

  if (language) {
    sql += ' AND language = ?';
    params.push(language);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Update status (e.g. 'new' -> 'reviewed')
router.put('/:id/status', (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!status) return res.status(400).json({ error: 'status_required' });

  const info = db.prepare('UPDATE cafeteria_feedback SET status = ? WHERE id = ?').run(status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });

  const row = db.prepare('SELECT * FROM cafeteria_feedback WHERE id = ?').get(req.params.id);
  res.json(row);
});

// Delete
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM cafeteria_feedback WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

module.exports = router;
