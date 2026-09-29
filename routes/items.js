const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { generateBarcodePNG } = require('../scripts/barcode');

function nextBarcode() {
  // 12-digit numeric code: timestamp-based, collision-safe enough for a small/medium inventory
  const row = db.prepare(`SELECT COUNT(*) AS c FROM items`).get();
  const seq = (row.c + 1).toString().padStart(6, '0');
  const prefix = '20'; // arbitrary org prefix
  return `${prefix}${Date.now().toString().slice(-6)}${seq.slice(-6)}`.slice(0, 12);
}

// List / search / filter
router.get('/', (req, res) => {
  const { q, category, low_stock } = req.query;
  let sql = 'SELECT * FROM items WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (name LIKE ? OR barcode LIKE ? OR supplier LIKE ? OR location LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (low_stock === '1') {
    sql += ' AND quantity <= reorder_level';
  }
  sql += ' ORDER BY name COLLATE NOCASE ASC';

  const items = db.prepare(sql).all(...params);
  res.json(items);
});

// Distinct categories (for filter dropdown)
router.get('/categories', (req, res) => {
  const rows = db.prepare(`SELECT DISTINCT category FROM items WHERE category != '' ORDER BY category`).all();
  res.json(rows.map(r => r.category));
});

// Lookup by barcode (for scanning)
router.get('/barcode/:code', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE barcode = ?').get(req.params.code);
  if (!item) return res.status(404).json({ error: 'not_found' });
  res.json(item);
});

// Get one
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  res.json(item);
});

// Barcode image (PNG) for an item
router.get('/:id/barcode.png', async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).end();
  try {
    const buf = await generateBarcodePNG(item.barcode);
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (err) {
    console.error('Barcode generation failed:', err);
    res.status(500).json({ error: 'barcode_generation_failed' });
  }
});

// Create
router.post('/', (req, res) => {
  const { name, category = '', quantity = 0, price = 0, supplier = '', location = '', reorder_level = 0 } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name_required' });

  let barcode = (req.body.barcode || '').trim();
  if (!barcode) barcode = nextBarcode();

  try {
    const stmt = db.prepare(`
      INSERT INTO items (name, barcode, category, quantity, price, supplier, location, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name.trim(), barcode, category, Number(quantity) || 0, Number(price) || 0, supplier, location, Number(reorder_level) || 0);
    if (Number(quantity) > 0) {
      db.prepare(`INSERT INTO stock_movements (item_id, change, reason) VALUES (?, ?, ?)`)
        .run(info.lastInsertRowid, Number(quantity), 'initial stock');
    }
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(item);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'barcode_exists' });
    }
    res.status(500).json({ error: 'server_error', detail: e.message });
  }
});

// Update
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const name = req.body.name ?? existing.name;
  const category = req.body.category ?? existing.category;
  const price = req.body.price !== undefined ? Number(req.body.price) : existing.price;
  const supplier = req.body.supplier ?? existing.supplier;
  const location = req.body.location ?? existing.location;
  const reorder_level = req.body.reorder_level !== undefined ? Number(req.body.reorder_level) : existing.reorder_level;
  const barcode = req.body.barcode ?? existing.barcode;

  try {
    db.prepare(`
      UPDATE items SET name=?, category=?, price=?, supplier=?, location=?, reorder_level=?, barcode=?, updated_at=datetime('now')
      WHERE id=?
    `).run(name, category, price, supplier, location, reorder_level, barcode, req.params.id);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'barcode_exists' });
    }
    res.status(500).json({ error: 'server_error', detail: e.message });
  }
});

// Stock adjustment (+/-), e.g. receiving stock or selling/using stock
router.post('/:id/adjust', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not_found' });

  const change = Number(req.body.change);
  const reason = req.body.reason || '';
  if (!Number.isFinite(change) || change === 0) {
    return res.status(400).json({ error: 'invalid_change' });
  }
  const newQty = item.quantity + change;
  if (newQty < 0) return res.status(400).json({ error: 'insufficient_stock' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE items SET quantity=?, updated_at=datetime('now') WHERE id=?`).run(newQty, item.id);
    db.prepare(`INSERT INTO stock_movements (item_id, change, reason) VALUES (?, ?, ?)`).run(item.id, change, reason);
  });
  tx();

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
  res.json(updated);
});

// Delete
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Movement history for an item
router.get('/:id/movements', (req, res) => {
  const rows = db.prepare(`SELECT * FROM stock_movements WHERE item_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(req.params.id);
  res.json(rows);
});

module.exports = router;
