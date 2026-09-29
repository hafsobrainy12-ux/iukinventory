const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/init');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username_and_password_required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ ok: true, username: user.username });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'not_logged_in' });
  res.json({ username: req.session.username });
});

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'not_logged_in' });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'current_and_new_password_required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'current_password_incorrect' });
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  res.json({ ok: true });
});

module.exports = router;
