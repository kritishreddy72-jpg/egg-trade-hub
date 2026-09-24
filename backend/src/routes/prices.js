const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireOwner } = require('../middleware/auth');

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// GET /api/prices/today (Public / authenticated users can check today's price)
router.get('/today', (req, res) => {
  const today = getTodayString();
  const priceRecord = db.prepare('SELECT * FROM daily_prices WHERE date = ?').get(today);
  
  if (!priceRecord) {
    // If not set for today, check the most recent price as fallback reference
    const latestRecord = db.prepare('SELECT * FROM daily_prices ORDER BY date DESC LIMIT 1').get();
    return res.json({
      date: today,
      isSetForToday: false,
      price: latestRecord ? latestRecord.price_per_tray : null,
      message: 'Price has not been set yet for today'
    });
  }

  return res.json({
    date: today,
    isSetForToday: true,
    price: priceRecord.price_per_tray,
    updatedAt: priceRecord.updated_at
  });
});

// GET /api/prices/by-date/:date
router.get('/by-date/:date', (req, res) => {
  const { date } = req.params;
  const priceRecord = db.prepare('SELECT * FROM daily_prices WHERE date = ?').get(date);
  if (!priceRecord) {
    // Fallback to latest prior price
    const latestPrior = db.prepare('SELECT * FROM daily_prices WHERE date <= ? ORDER BY date DESC LIMIT 1').get(date);
    return res.json({
      date,
      found: false,
      price: latestPrior ? latestPrior.price_per_tray : 200.0,
      fallback: true
    });
  }
  return res.json({
    date,
    found: true,
    price: priceRecord.price_per_tray
  });
});

// GET /api/prices/history
router.get('/history', verifyToken, (req, res) => {
  const history = db.prepare('SELECT * FROM daily_prices ORDER BY date DESC LIMIT 60').all();
  return res.json({ history });
});

// POST /api/prices/today (Owner only)
router.post('/today', verifyToken, requireOwner, (req, res) => {
  const { price, date } = req.body;
  const targetDate = date ? date.trim() : getTodayString();

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return res.status(400).json({ error: 'Valid positive price per tray is required (e.g., 200.00)' });
  }

  try {
    const upsertStmt = db.prepare(`
      INSERT INTO daily_prices (date, price_per_tray, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date) DO UPDATE SET
        price_per_tray = excluded.price_per_tray,
        updated_at = CURRENT_TIMESTAMP
    `);
    upsertStmt.run(targetDate, numPrice);

    return res.json({
      message: `Egg tray price for ${targetDate} updated to ₹${numPrice.toFixed(2)}`,
      date: targetDate,
      price_per_tray: numPrice
    });
  } catch (err) {
    console.error('Error setting daily price:', err);
    return res.status(500).json({ error: 'Failed to save daily price' });
  }
});

module.exports = router;
