const express = require('express');
const router = express.Router();
const db = require('../db/init');

function toCSV(rows, columns) {
  const header = columns.map(c => c.label).join(',');
  const lines = rows.map(row => columns.map(c => {
    let v = row[c.key];
    if (v === null || v === undefined) v = '';
    v = String(v).replace(/"/g, '""');
    if (/[",\n]/.test(v)) v = `"${v}"`;
    return v;
  }).join(','));
  return [header, ...lines].join('\r\n');
}

function sendCSV(res, filename, csv) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// Overall summary + breakdown by category
router.get('/summary', (req, res) => {
  const items = db.prepare('SELECT * FROM items').all();
  const totalItems = items.length;
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const lowStock = items.filter(i => i.quantity <= i.reorder_level);

  const byCategoryMap = new Map();
  for (const i of items) {
    const cat = i.category && i.category.trim() ? i.category.trim() : 'Uncategorized';
    if (!byCategoryMap.has(cat)) byCategoryMap.set(cat, { category: cat, itemCount: 0, totalUnits: 0, totalValue: 0 });
    const c = byCategoryMap.get(cat);
    c.itemCount += 1;
    c.totalUnits += i.quantity;
    c.totalValue += i.quantity * i.price;
  }
  const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.totalValue - a.totalValue);

  res.json({
    totalItems,
    totalUnits,
    totalValue,
    lowStockCount: lowStock.length,
    byCategory,
    generatedAt: new Date().toISOString(),
  });
});

// Full inventory report
router.get('/inventory', (req, res) => {
  const items = db.prepare('SELECT * FROM items ORDER BY category, name COLLATE NOCASE ASC').all();
  if (req.query.format === 'csv') {
    const csv = toCSV(items, [
      { key: 'name', label: 'Name' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'price', label: 'Unit Price' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'location', label: 'Location' },
      { key: 'reorder_level', label: 'Reorder Level' },
      { key: 'updated_at', label: 'Last Updated' },
    ]);
    return sendCSV(res, 'iuk-inventory-full-report.csv', csv);
  }
  res.json(items);
});

// Low stock report
router.get('/low-stock', (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE quantity <= reorder_level ORDER BY name COLLATE NOCASE ASC').all();
  if (req.query.format === 'csv') {
    const csv = toCSV(items, [
      { key: 'name', label: 'Name' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'reorder_level', label: 'Reorder Level' },
      { key: 'location', label: 'Location' },
      { key: 'supplier', label: 'Supplier' },
    ]);
    return sendCSV(res, 'iuk-inventory-low-stock-report.csv', csv);
  }
  res.json(items);
});

// Stock movement history (most recent first)
router.get('/movements', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db.prepare(`
    SELECT m.id, m.change, m.reason, m.created_at, i.name AS item_name, i.barcode
    FROM stock_movements m
    JOIN items i ON i.id = m.item_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ?
  `).all(limit);

  if (req.query.format === 'csv') {
    const csv = toCSV(rows, [
      { key: 'created_at', label: 'Date' },
      { key: 'item_name', label: 'Item' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'change', label: 'Change' },
      { key: 'reason', label: 'Reason' },
    ]);
    return sendCSV(res, 'iuk-inventory-stock-movements.csv', csv);
  }
  res.json(rows);
});

module.exports = router;
