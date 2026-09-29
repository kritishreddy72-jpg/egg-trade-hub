const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireOwner, requireUser } = require('../middleware/auth');

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// GET /api/customers/my/balance (Customer views their own balance & breakdown)
router.get('/my/balance', verifyToken, requireUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Calculate net credit balance from credit_ledger
    const balanceRow = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'credit_added' THEN amount WHEN type = 'credit_settled' THEN -amount ELSE 0 END), 0) as balance
      FROM credit_ledger WHERE user_id = ?
    `).get(userId);

    const balance = balanceRow ? Math.max(0, balanceRow.balance) : 0;

    // Contributing unpaid orders
    const unpaidOrders = await db.prepare(`
      SELECT id, order_date, delivery_date, trays, price_per_tray, total_amount, payment_mode, payment_status, order_status
      FROM orders
      WHERE user_id = ? AND payment_mode = 'credit' AND payment_status = 'pending'
      ORDER BY id ASC
    `).all(userId);

    // Recent ledger entries
    const recentLedger = await db.prepare(`
      SELECT id, amount, type, notes, date, created_at
      FROM credit_ledger
      WHERE user_id = ?
      ORDER BY id DESC LIMIT 10
    `).all(userId);

    return res.json({
      outstandingBalance: balance,
      unpaidOrdersCount: unpaidOrders.length,
      unpaidOrders,
      recentLedger
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers (Owner views customer list with search & balances)
router.get('/', verifyToken, requireOwner, async (req, res, next) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 
        u.id, u.name, u.phone, u.email, u.address, u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(CASE WHEN o.order_status != 'cancelled' THEN o.trays ELSE 0 END), 0) as total_trays,
        COALESCE(SUM(CASE WHEN o.order_status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) as total_spent,
        COALESCE(
          (SELECT SUM(CASE WHEN cl.type = 'credit_added' THEN cl.amount WHEN cl.type = 'credit_settled' THEN -cl.amount ELSE 0 END)
           FROM credit_ledger cl WHERE cl.user_id = u.id),
          0
        ) as credit_balance,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND order_status IN ('pending', 'confirmed', 'out_for_delivery')) as active_orders_count
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'user'
    `;

    const params = [];
    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR u.phone LIKE ? OR u.address LIKE ?)`;
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    query += ` GROUP BY u.id ORDER BY credit_balance DESC, u.name ASC`;

    const customers = await db.prepare(query).all(...params);

    return res.json({ customers });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id (Owner views specific customer's full record)
router.get('/:id', verifyToken, requireOwner, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await db.prepare(`
      SELECT id, name, phone, email, address, created_at
      FROM users WHERE id = ? AND role = 'user'
    `).get(id);

    if (!user) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Calculate balance
    const balanceRow = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'credit_added' THEN amount WHEN type = 'credit_settled' THEN -amount ELSE 0 END), 0) as balance
      FROM credit_ledger WHERE user_id = ?
    `).get(id);
    const creditBalance = balanceRow ? balanceRow.balance : 0;

    // Active/pending orders
    const activeOrders = await db.prepare(`
      SELECT * FROM orders
      WHERE user_id = ? AND order_status IN ('pending', 'confirmed', 'out_for_delivery')
      ORDER BY id DESC
    `).all(id);

    // Unpaid credit orders
    const unpaidCreditOrders = await db.prepare(`
      SELECT * FROM orders
      WHERE user_id = ? AND payment_mode = 'credit' AND payment_status = 'pending'
      ORDER BY id ASC
    `).all(id);

    // All past orders
    const orderHistory = await db.prepare(`
      SELECT * FROM orders
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(id);

    // Credit ledger transactions
    const ledgerHistory = await db.prepare(`
      SELECT * FROM credit_ledger
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(id);

    return res.json({
      customer: user,
      creditBalance,
      activeOrders,
      unpaidCreditOrders,
      orderHistory,
      ledgerHistory
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/customers/:id/settle-credit (Owner records payment towards credit balance)
router.post('/:id/settle-credit', verifyToken, requireOwner, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, notes = '' } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid positive payment amount' });
    }

    const user = await db.prepare('SELECT id, name FROM users WHERE id = ? AND role = \'user\'').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const today = getTodayString();

    // 1. Add credit_settled entry in ledger
    const ledgerStmt = db.prepare(`
      INSERT INTO credit_ledger (user_id, amount, type, notes, date)
      VALUES (?, ?, 'credit_settled', ?, ?)
    `);
    await ledgerStmt.run(
      id,
      numAmount,
      notes || `Payment received from ${user.name} towards credit balance`,
      today
    );

    // 2. Mark oldest pending credit orders as paid up to the settlement amount
    let remainingSettlement = numAmount;
    const pendingOrders = await db.prepare(`
      SELECT id, total_amount FROM orders
      WHERE user_id = ? AND payment_mode = 'credit' AND payment_status = 'pending'
      ORDER BY id ASC
    `).all(id);

    for (const order of pendingOrders) {
      if (remainingSettlement >= order.total_amount) {
        await db.prepare('UPDATE orders SET payment_status = \'paid\' WHERE id = ?').run(order.id);
        remainingSettlement -= order.total_amount;
      } else {
        break;
      }
    }

    const balanceRow = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'credit_added' THEN amount WHEN type = 'credit_settled' THEN -amount ELSE 0 END), 0) as balance
      FROM credit_ledger WHERE user_id = ?
    `).get(id);

    return res.json({
      message: `Successfully received ₹${numAmount.toFixed(2)} from ${user.name}`,
      updatedBalance: balanceRow ? balanceRow.balance : 0
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
