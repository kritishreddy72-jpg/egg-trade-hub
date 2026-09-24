const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireOwner } = require('../middleware/auth');

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// GET /api/analytics/daily-summary?date=YYYY-MM-DD
router.get('/daily-summary', verifyToken, requireOwner, (req, res) => {
  const targetDate = req.query.date ? req.query.date.trim() : getTodayString();

  // 1. Total trays sold on that date (non-cancelled)
  const traysRow = db.prepare(`
    SELECT COALESCE(SUM(trays), 0) as total_trays,
           COUNT(*) as total_orders
    FROM orders
    WHERE order_date = ? AND order_status != 'cancelled'
  `).get(targetDate);

  // 2. Total Cash received on that date (from cash orders marked paid + counter sales)
  const cashOrdersRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as cash_from_orders
    FROM orders
    WHERE order_date = ? AND payment_mode = 'cash' AND order_status != 'cancelled'
  `).get(targetDate);

  // Cash received from direct credit settlements on that date
  const settlementsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as cash_from_settlements
    FROM credit_ledger
    WHERE date = ? AND type = 'credit_settled'
  `).get(targetDate);

  const totalCashReceived = (cashOrdersRow ? cashOrdersRow.cash_from_orders : 0) + 
                            (settlementsRow ? settlementsRow.cash_from_settlements : 0);

  // 3. Total new credit balance added on that date
  const creditAddedRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_credit_added
    FROM credit_ledger
    WHERE date = ? AND type = 'credit_added'
  `).get(targetDate);

  // 4. Running total of all-time outstanding credit balance across all users
  const allTimeOutstandingRow = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'credit_added' THEN amount WHEN type = 'credit_settled' THEN -amount ELSE 0 END), 0) as total_outstanding
    FROM credit_ledger
  `).get();

  // 5. User breakdown for that date
  // Users who had orders on targetDate OR have current credit balance
  const userBreakdown = db.prepare(`
    SELECT 
      u.id as user_id,
      u.name as user_name,
      u.phone as user_phone,
      u.address as user_address,
      COALESCE(SUM(CASE WHEN o.order_date = ? AND o.order_status != 'cancelled' THEN o.trays ELSE 0 END), 0) as trays_today,
      COALESCE(SUM(CASE WHEN o.order_date = ? AND o.payment_mode = 'cash' AND o.order_status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) as cash_today,
      COALESCE(SUM(CASE WHEN o.order_date = ? AND o.payment_mode = 'credit' AND o.order_status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) as credit_added_today,
      COALESCE(
        (SELECT SUM(CASE WHEN cl.type = 'credit_added' THEN cl.amount WHEN cl.type = 'credit_settled' THEN -cl.amount ELSE 0 END)
         FROM credit_ledger cl WHERE cl.user_id = u.id),
        0
      ) as running_credit_balance
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY trays_today DESC, running_credit_balance DESC
  `).all(targetDate, targetDate, targetDate);

  // Price for that date
  const priceRecord = db.prepare('SELECT price_per_tray FROM daily_prices WHERE date = ?').get(targetDate);

  return res.json({
    date: targetDate,
    pricePerTray: priceRecord ? priceRecord.price_per_tray : null,
    totalTraysSold: traysRow ? traysRow.total_trays : 0,
    totalOrdersCount: traysRow ? traysRow.total_orders : 0,
    totalCashReceived: Math.round(totalCashReceived * 100) / 100,
    totalCashFromOrders: Math.round((cashOrdersRow ? cashOrdersRow.cash_from_orders : 0) * 100) / 100,
    totalCashFromSettlements: Math.round((settlementsRow ? settlementsRow.cash_from_settlements : 0) * 100) / 100,
    totalCreditAdded: Math.round((creditAddedRow ? creditAddedRow.total_credit_added : 0) * 100) / 100,
    allTimeOutstandingCredit: Math.round((allTimeOutstandingRow ? allTimeOutstandingRow.total_outstanding : 0) * 100) / 100,
    userBreakdown
  });
});

// GET /api/analytics/trends?days=7
// Provides multi-day trend for charts (daily trays, cash vs credit)
router.get('/trends', verifyToken, requireOwner, (req, res) => {
  const numDays = parseInt(req.query.days, 10) || 7;

  // Generate date list
  const trends = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN trays ELSE 0 END), 0) as trays,
        COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN payment_mode = 'credit' AND order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) as credit
      FROM orders
      WHERE order_date = ?
    `).get(dateStr);

    const priceRow = db.prepare('SELECT price_per_tray FROM daily_prices WHERE date = ?').get(dateStr);

    trends.push({
      date: dateStr,
      displayDate: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      trays: stats ? stats.trays : 0,
      cash: stats ? Math.round(stats.cash) : 0,
      credit: stats ? Math.round(stats.credit) : 0,
      totalSales: stats ? Math.round(stats.cash + stats.credit) : 0,
      price: priceRow ? priceRow.price_per_tray : null
    });
  }

  return res.json({ trends });
});

module.exports = router;
