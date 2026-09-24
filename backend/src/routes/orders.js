const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireOwner, requireUser } = require('../middleware/auth');

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getPriceForDate(dateStr) {
  const priceRecord = db.prepare('SELECT price_per_tray FROM daily_prices WHERE date = ?').get(dateStr);
  if (priceRecord) {
    return priceRecord.price_per_tray;
  }
  // Fallback to most recent price
  const latest = db.prepare('SELECT price_per_tray FROM daily_prices ORDER BY date DESC LIMIT 1').get();
  return latest ? latest.price_per_tray : 200.0;
}

// POST /api/orders (Customer creates order)
router.post('/', verifyToken, (req, res) => {
  const userId = req.user.role === 'owner' && req.body.user_id ? req.body.user_id : req.user.id;
  const { trays, delivery_date, payment_mode = 'cash', notes = '' } = req.body;

  const numTrays = parseInt(trays, 10);
  if (isNaN(numTrays) || numTrays <= 0) {
    return res.status(400).json({ error: 'Please enter a valid number of trays (minimum 1)' });
  }

  const today = getTodayString();
  const targetDeliveryDate = delivery_date ? delivery_date.trim() : today;
  const pricePerTray = getPriceForDate(today);
  const totalAmount = Math.round(numTrays * pricePerTray * 100) / 100;

  const chosenPaymentMode = payment_mode === 'credit' ? 'credit' : 'cash';
  // Cash on delivery is marked pending payment until delivered, credit is marked pending
  const paymentStatus = 'pending';
  const orderStatus = 'pending';
  const createdBy = req.user.role === 'owner' ? 'owner' : 'user';

  const insertOrder = db.transaction(() => {
    const orderStmt = db.prepare(`
      INSERT INTO orders (
        user_id, order_date, delivery_date, trays, price_per_tray,
        total_amount, payment_mode, payment_status, order_status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = orderStmt.run(
      userId,
      today,
      targetDeliveryDate,
      numTrays,
      pricePerTray,
      totalAmount,
      chosenPaymentMode,
      paymentStatus,
      orderStatus,
      notes,
      createdBy
    );

    const orderId = result.lastInsertRowid;

    // If payment_mode is credit, add to credit_ledger
    if (chosenPaymentMode === 'credit') {
      db.prepare(`
        INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
        VALUES (?, ?, ?, 'credit_added', ?, ?)
      `).run(userId, orderId, totalAmount, `Credit for Order #${orderId} (${numTrays} trays)`, today);
    }

    return orderId;
  });

  try {
    const orderId = insertOrder();
    const createdOrder = db.prepare(`
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(orderId);

    return res.status(201).json({
      message: 'Order placed successfully!',
      order: createdOrder
    });
  } catch (err) {
    console.error('Error placing order:', err);
    return res.status(500).json({ error: 'Failed to place order' });
  }
});

// POST /api/orders/fast-entry (Owner rapid order & payment flow)
// Core workflow requirement:
// Owner enters trays -> auto calculates price -> selects "Cash on Delivery" or "Credit" -> saved instantly
router.post('/fast-entry', verifyToken, requireOwner, (req, res) => {
  const { user_id, trays, payment_mode, notes = '', delivery_date } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'Customer is required' });
  }

  const numTrays = parseInt(trays, 10);
  if (isNaN(numTrays) || numTrays <= 0) {
    return res.status(400).json({ error: 'Please enter a valid number of trays' });
  }

  if (!payment_mode || !['cash', 'credit'].includes(payment_mode)) {
    return res.status(400).json({ error: 'Please select payment mode: Cash on Delivery or Credit' });
  }

  const today = getTodayString();
  const targetDeliveryDate = delivery_date ? delivery_date.trim() : today;
  const pricePerTray = getPriceForDate(today);
  const totalAmount = Math.round(numTrays * pricePerTray * 100) / 100;

  const isCash = payment_mode === 'cash';
  const paymentStatus = isCash ? 'paid' : 'pending';
  const orderStatus = 'delivered'; // Owner counter order is considered fulfilled immediately or confirmed

  const executeFastEntry = db.transaction(() => {
    const orderStmt = db.prepare(`
      INSERT INTO orders (
        user_id, order_date, delivery_date, trays, price_per_tray,
        total_amount, payment_mode, payment_status, order_status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = orderStmt.run(
      user_id,
      today,
      targetDeliveryDate,
      numTrays,
      pricePerTray,
      totalAmount,
      payment_mode,
      paymentStatus,
      orderStatus,
      notes || (isCash ? 'Counter sale - Cash received' : 'Counter sale - Added to credit'),
      'owner'
    );

    const orderId = result.lastInsertRowid;

    if (!isCash) {
      // Credit selected: automatically add to user's outstanding credit balance
      db.prepare(`
        INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
        VALUES (?, ?, ?, 'credit_added', ?, ?)
      `).run(user_id, orderId, totalAmount, `Credit Order #${orderId} (${numTrays} trays @ ₹${pricePerTray})`, today);
    }

    return orderId;
  });

  try {
    const orderId = executeFastEntry();
    const order = db.prepare(`
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(orderId);

    // Calculate updated credit balance for this customer
    const balanceRow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'credit_added' THEN amount WHEN type = 'credit_settled' THEN -amount ELSE 0 END), 0) as balance
      FROM credit_ledger WHERE user_id = ?
    `).get(user_id);

    return res.status(201).json({
      message: isCash
        ? `Order #${orderId} recorded: ₹${totalAmount.toFixed(2)} Cash Received`
        : `Order #${orderId} recorded: ₹${totalAmount.toFixed(2)} Added to ${order.customer_name}'s Credit`,
      order,
      customerBalance: balanceRow ? balanceRow.balance : 0
    });
  } catch (err) {
    console.error('Error during fast order entry:', err);
    return res.status(500).json({ error: 'Failed to process fast order entry' });
  }
});

// GET /api/orders/today (Owner only)
// 3a & 3b: Orders Received Today + Total Trays Required Today
router.get('/today', verifyToken, requireOwner, (req, res) => {
  const today = getTodayString();

  const orders = db.prepare(`
    SELECT o.*, u.name as customer_name, u.phone as customer_phone, u.address as customer_address
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.order_date = ?
    ORDER BY o.id DESC
  `).all(today);

  const totalTraysToday = orders.reduce((sum, o) => sum + (o.order_status !== 'cancelled' ? o.trays : 0), 0);
  const totalAmountToday = orders.reduce((sum, o) => sum + (o.order_status !== 'cancelled' ? o.total_amount : 0), 0);

  return res.json({
    date: today,
    totalTraysToday,
    totalAmountToday,
    totalOrdersToday: orders.length,
    orders
  });
});

// GET /api/orders/my-orders (Customer orders)
router.get('/my-orders', verifyToken, requireUser, (req, res) => {
  const userId = req.user.id;

  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(userId);

  return res.json({ orders });
});

// GET /api/orders/active (Customer active order)
router.get('/active', verifyToken, requireUser, (req, res) => {
  const userId = req.user.id;

  // Active is any order with status pending, confirmed, or out_for_delivery
  const activeOrder = db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ? AND order_status IN ('pending', 'confirmed', 'out_for_delivery')
    ORDER BY id DESC LIMIT 1
  `).get(userId);

  // If no pending order, fetch latest delivered order for quick reference
  const latestOrder = activeOrder || db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(userId);

  return res.json({
    activeOrder: activeOrder || null,
    latestOrder: latestOrder || null
  });
});

// PATCH /api/orders/:id/status (Owner updates order status)
router.patch('/:id/status', verifyToken, requireOwner, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${validStatuses.join(', ')}` });
  }

  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const updateTx = db.transaction(() => {
    let updatePaymentStatus = existing.payment_status;

    // If order was cash on delivery and is now delivered, mark it paid
    if (status === 'delivered' && existing.payment_mode === 'cash' && existing.payment_status === 'pending') {
      updatePaymentStatus = 'paid';
    }

    // If order is cancelled and was credit, cancel credit in ledger
    if (status === 'cancelled' && existing.payment_mode === 'credit' && existing.order_status !== 'cancelled') {
      db.prepare(`
        INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
        VALUES (?, ?, ?, 'credit_settled', ?, ?)
      `).run(
        existing.user_id,
        existing.id,
        existing.total_amount,
        `Order #${existing.id} Cancelled - Credit Reversed`,
        getTodayString()
      );
      updatePaymentStatus = 'pending';
    }

    db.prepare(`
      UPDATE orders
      SET order_status = ?, payment_status = ?
      WHERE id = ?
    `).run(status, updatePaymentStatus, id);
  });

  try {
    updateTx();
    const updated = db.prepare(`
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(id);

    return res.json({
      message: `Order #${id} status changed to ${status}`,
      order: updated
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

// PATCH /api/orders/:id/payment (Owner changes payment mode or records cash collection)
router.patch('/:id/payment', verifyToken, requireOwner, (req, res) => {
  const { id } = req.params;
  const { payment_mode, payment_status } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const today = getTodayString();

  const changeTx = db.transaction(() => {
    // If transitioning from credit to cash/paid:
    if (order.payment_mode === 'credit' && payment_mode === 'cash') {
      // reverse credit from ledger
      db.prepare(`
        INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
        VALUES (?, ?, ?, 'credit_settled', 'Switched to Cash on Delivery', ?)
      `).run(order.user_id, order.id, order.total_amount, today);
    } else if (order.payment_mode === 'cash' && payment_mode === 'credit') {
      // add to credit ledger
      db.prepare(`
        INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
        VALUES (?, ?, ?, 'credit_added', 'Switched to Credit Account', ?)
      `).run(order.user_id, order.id, order.total_amount, today);
    }

    const newMode = payment_mode || order.payment_mode;
    const newStatus = payment_status || order.payment_status;

    db.prepare(`
      UPDATE orders
      SET payment_mode = ?, payment_status = ?
      WHERE id = ?
    `).run(newMode, newStatus, id);
  });

  try {
    changeTx();
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    return res.json({ message: 'Order payment updated successfully', order: updated });
  } catch (err) {
    console.error('Error updating payment:', err);
    return res.status(500).json({ error: 'Failed to update order payment' });
  }
});

module.exports = router;
