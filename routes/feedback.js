const express = require('express');
const router = express.Router();
const db = require('../db/init');

const ALLOWED_LANGUAGES = ['en', 'ar', 'sw', 'so', 'fr'];

// Public: submit a piece of cafeteria feedback. No login required â
// this is reached by students scanning the QR code.
router.post('/', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message_required' });
  }

  let language = (req.body.language || 'en').toLowerCase();
  if (!ALLOWED_LANGUAGES.includes(language)) language = 'en';

  const category = String(req.body.category || '').trim().slice(0, 60);
  const contact = String(req.body.contact || '').trim().slice(0, 120);
  const trimmedMessage = message.trim().slice(0, 2000);

  try {
    const info = db.prepare(`
      INSERT INTO cafeteria_feedback (language, category, message, contact)
      VALUES (?, ?, ?, ?)
    `).run(language, category, trimmedMessage, contact);
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: e.message });
  }
});

module.exports = router;
