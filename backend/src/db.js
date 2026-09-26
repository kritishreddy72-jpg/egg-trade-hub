const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? '/tmp' : path.resolve(__dirname, '..');
const dbPath = path.join(dbDir, 'egg_trade.db');

let db = null;
let isNewDb = true;

// 1. Try better-sqlite3 ONLY when not in serverless (local disk persistence)
if (!isVercel) {
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    isNewDb = !fs.existsSync(dbPath);
  } catch (err) {
    console.warn('better-sqlite3 unavailable, falling back to node:sqlite:', err.message);
  }
}

// 2. Try node:sqlite (native built-in to modern Node.js 22+, zero compilation dependencies)
if (!db) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    // On Vercel serverless, in-memory SQLite executes in 0.1ms with zero filesystem friction
    db = new DatabaseSync(isVercel ? ':memory:' : dbPath);
    isNewDb = true;

    // Polyfill db.transaction for better-sqlite3 API compatibility
    if (typeof db.transaction !== 'function') {
      db.transaction = function(fn) {
        return function(...args) {
          db.exec('BEGIN');
          try {
            const result = fn(...args);
            db.exec('COMMIT');
            return result;
          } catch (e) {
            db.exec('ROLLBACK');
            throw e;
          }
        };
      };
    }

    // Polyfill db.pragma
    if (typeof db.pragma !== 'function') {
      db.pragma = function(pragmaStr) {
        try {
          db.exec(`PRAGMA ${pragmaStr}`);
        } catch (e) {}
      };
    }

    // Ensure statement.run returns numeric lastInsertRowid (not BigInt) for safe JSON serialization
    const origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      const stmt = origPrepare(sql);
      const origRun = stmt.run.bind(stmt);
      stmt.run = function(...args) {
        const result = origRun(...args);
        return {
          changes: Number(result.changes || 0),
          lastInsertRowid: Number(result.lastInsertRowid || 0)
        };
      };
      return stmt;
    };
  } catch (err) {
    console.warn('node:sqlite unavailable, using universal memory fallback:', err.message);
  }
}

// 3. Universal in-memory fallback if neither SQLite engine is available
if (!db) {
  console.log('Initializing universal in-memory database store...');
  db = createMemoryFallback();
}

// Initialize schema (if native SQLite engine is used)
function initSchema() {
  if (typeof db.exec !== 'function') return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        address TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'user')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE, -- format: YYYY-MM-DD
        price_per_tray REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_date TEXT NOT NULL, -- format: YYYY-MM-DD
        delivery_date TEXT NOT NULL, -- format: YYYY-MM-DD
        trays INTEGER NOT NULL,
        price_per_tray REAL NOT NULL,
        total_amount REAL NOT NULL,
        payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash', 'credit')),
        payment_status TEXT NOT NULL CHECK(payment_status IN ('paid', 'pending')),
        order_status TEXT NOT NULL DEFAULT 'pending' CHECK(order_status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled')),
        notes TEXT,
        created_by TEXT NOT NULL DEFAULT 'user' CHECK(created_by IN ('user', 'owner')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credit_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit_added', 'credit_settled')),
        notes TEXT,
        date TEXT NOT NULL, -- format: YYYY-MM-DD
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
      CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_mode, payment_status);
      CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(date);
    `);
  } catch (e) {
    console.warn('initSchema notice:', e.message);
  }
}

initSchema();

// Auto-seed if database has no users (e.g. fresh Vercel serverless cold start)
try {
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const count = userCountRow ? (userCountRow.count !== undefined ? userCountRow.count : Object.values(userCountRow)[0]) : 0;
  if (count === 0) {
    console.log('Database empty on start — auto-seeding demo accounts...');
    const seedDatabase = require('./seed');
    seedDatabase(db);
  }
} catch (err) {
  console.warn('Auto-seed check notice:', err.message);
}

function createMemoryFallback() {
  const bcrypt = require('bcryptjs');
  const ownerHash = bcrypt.hashSync('owner123', 10);
  const userHash = bcrypt.hashSync('user123', 10);

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const d1 = new Date(now); d1.setDate(d1.getDate() - 1); const dayMinus1 = d1.toISOString().split('T')[0];
  const d2 = new Date(now); d2.setDate(d2.getDate() - 2); const dayMinus2 = d2.toISOString().split('T')[0];
  const d3 = new Date(now); d3.setDate(d3.getDate() - 3); const dayMinus3 = d3.toISOString().split('T')[0];
  const d4 = new Date(now); d4.setDate(d4.getDate() - 4); const dayMinus4 = d4.toISOString().split('T')[0];

  const store = {
    users: [
      { id: 1, name: 'Rajesh Sharma (Owner)', phone: '9999999999', email: 'owner@eggtrade.com', address: 'Main Warehouse, Wholesale Market', password_hash: ownerHash, role: 'owner', created_at: today },
      { id: 2, name: 'Sri Krishna Bakery', phone: '9876543211', email: 'bakery@example.com', address: '12 MG Road, Market Area', password_hash: userHash, role: 'user', created_at: dayMinus4 },
      { id: 3, name: 'Anand Supermarket', phone: '9876543212', email: 'anand@example.com', address: 'Shop 4, Commercial Complex, Main Bazaar', password_hash: userHash, role: 'user', created_at: dayMinus4 },
      { id: 4, name: 'Hotel Annapurna', phone: '9876543213', email: 'annapurna@example.com', address: 'Opp. City Bus Stand, Highway Junction', password_hash: userHash, role: 'user', created_at: dayMinus3 },
      { id: 5, name: 'Ramesh Dhabha', phone: '9876543214', email: 'ramesh@example.com', address: 'Highway Bypass, Sector 5', password_hash: userHash, role: 'user', created_at: dayMinus2 }
    ],
    daily_prices: [
      { id: 1, date: dayMinus4, price_per_tray: 195.0, created_at: dayMinus4, updated_at: dayMinus4 },
      { id: 2, date: dayMinus3, price_per_tray: 198.0, created_at: dayMinus3, updated_at: dayMinus3 },
      { id: 3, date: dayMinus2, price_per_tray: 202.0, created_at: dayMinus2, updated_at: dayMinus2 },
      { id: 4, date: dayMinus1, price_per_tray: 205.0, created_at: dayMinus1, updated_at: dayMinus1 },
      { id: 5, date: today, price_per_tray: 210.0, created_at: today, updated_at: today }
    ],
    orders: [
      { id: 1, user_id: 2, order_date: dayMinus3, delivery_date: dayMinus3, trays: 50, price_per_tray: 198.0, total_amount: 9900.0, payment_mode: 'credit', payment_status: 'pending', order_status: 'delivered', notes: 'Regular morning bulk delivery', created_by: 'user', created_at: dayMinus3 },
      { id: 2, user_id: 2, order_date: dayMinus1, delivery_date: dayMinus1, trays: 40, price_per_tray: 205.0, total_amount: 8200.0, payment_mode: 'credit', payment_status: 'pending', order_status: 'delivered', notes: 'Special cake batch egg requirement', created_by: 'user', created_at: dayMinus1 },
      { id: 3, user_id: 2, order_date: today, delivery_date: today, trays: 45, price_per_tray: 210.0, total_amount: 9450.0, payment_mode: 'credit', payment_status: 'pending', order_status: 'pending', notes: 'Morning dispatch please deliver before 10 AM', created_by: 'user', created_at: today },
      { id: 4, user_id: 3, order_date: dayMinus4, delivery_date: dayMinus4, trays: 80, price_per_tray: 195.0, total_amount: 15600.0, payment_mode: 'cash', payment_status: 'paid', order_status: 'delivered', notes: 'Weekend stock replenishment', created_by: 'user', created_at: dayMinus4 },
      { id: 5, user_id: 3, order_date: dayMinus2, delivery_date: dayMinus2, trays: 60, price_per_tray: 202.0, total_amount: 12120.0, payment_mode: 'credit', payment_status: 'pending', order_status: 'delivered', notes: 'Mid-week stock', created_by: 'user', created_at: dayMinus2 },
      { id: 6, user_id: 3, order_date: today, delivery_date: today, trays: 70, price_per_tray: 210.0, total_amount: 14700.0, payment_mode: 'credit', payment_status: 'pending', order_status: 'confirmed', notes: 'Daily grocery retail trays', created_by: 'owner', created_at: today },
      { id: 7, user_id: 4, order_date: dayMinus3, delivery_date: dayMinus3, trays: 30, price_per_tray: 198.0, total_amount: 5940.0, payment_mode: 'cash', payment_status: 'paid', order_status: 'delivered', notes: 'Breakfast buffet usage', created_by: 'user', created_at: dayMinus3 },
      { id: 8, user_id: 4, order_date: dayMinus1, delivery_date: dayMinus1, trays: 35, price_per_tray: 205.0, total_amount: 7175.0, payment_mode: 'credit', payment_status: 'pending', order_status: 'delivered', notes: 'Kitchen order', created_by: 'user', created_at: dayMinus1 },
      { id: 9, user_id: 4, order_date: today, delivery_date: today, trays: 40, price_per_tray: 210.0, total_amount: 8400.0, payment_mode: 'cash', payment_status: 'pending', order_status: 'out_for_delivery', notes: 'Hand over to head chef', created_by: 'user', created_at: today },
      { id: 10, user_id: 5, order_date: dayMinus2, delivery_date: dayMinus2, trays: 25, price_per_tray: 202.0, total_amount: 5050.0, payment_mode: 'cash', payment_status: 'paid', order_status: 'delivered', notes: 'Curry eggs supply', created_by: 'user', created_at: dayMinus2 },
      { id: 11, user_id: 5, order_date: today, delivery_date: today, trays: 30, price_per_tray: 210.0, total_amount: 6300.0, payment_mode: 'cash', payment_status: 'paid', order_status: 'delivered', notes: 'Early morning counter delivery - Cash Paid', created_by: 'owner', created_at: today }
    ],
    credit_ledger: [
      { id: 1, user_id: 2, order_id: 1, amount: 9900.0, type: 'credit_added', notes: 'Credit for Order #1 (50 trays)', date: dayMinus3, created_at: dayMinus3 },
      { id: 2, user_id: 2, order_id: null, amount: 5000.0, type: 'credit_settled', notes: 'Bank Transfer / Cash payment received', date: dayMinus1, created_at: dayMinus1 },
      { id: 3, user_id: 2, order_id: 2, amount: 8200.0, type: 'credit_added', notes: 'Credit for Order #2 (40 trays)', date: dayMinus1, created_at: dayMinus1 },
      { id: 4, user_id: 2, order_id: 3, amount: 9450.0, type: 'credit_added', notes: 'Credit for Order #3 (45 trays)', date: today, created_at: today },
      { id: 5, user_id: 3, order_id: 5, amount: 12120.0, type: 'credit_added', notes: 'Credit for Order #5 (60 trays)', date: dayMinus2, created_at: dayMinus2 },
      { id: 6, user_id: 3, order_id: 6, amount: 14700.0, type: 'credit_added', notes: 'Credit for Order #6 (70 trays)', date: today, created_at: today },
      { id: 7, user_id: 4, order_id: 8, amount: 7175.0, type: 'credit_added', notes: 'Credit for Order #8 (35 trays)', date: dayMinus1, created_at: dayMinus1 }
    ]
  };

  function getUserCredit(userId) {
    return store.credit_ledger
      .filter(l => l.user_id === userId)
      .reduce((sum, l) => sum + (l.type === 'credit_added' ? l.amount : -l.amount), 0);
  }

  return {
    exec: () => {},
    pragma: () => {},
    transaction: (fn) => (...args) => fn(...args),
    prepare: (sql) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      return {
        get: (...params) => {
          if (s.includes('FROM users WHERE (phone = ? OR email = ?)')) {
            const [p1, p2] = params;
            return store.users.find(u => u.phone === p1 || (u.email && u.email === p2)) || null;
          }
          if (s.includes('FROM users WHERE phone = ?')) {
            return store.users.find(u => u.phone === params[0]) || null;
          }
          if (s.includes('FROM users WHERE id = ?')) {
            const user = store.users.find(u => u.id === Number(params[0]));
            if (!user) return null;
            if (s.includes("role = 'user'")) return user.role === 'user' ? user : null;
            return user;
          }
          if (s.includes('COUNT(*) as count FROM users')) {
            return { count: store.users.length };
          }
          if (s.includes('FROM daily_prices WHERE date = ?')) {
            return store.daily_prices.find(p => p.date === params[0]) || null;
          }
          if (s.includes('FROM daily_prices ORDER BY date DESC LIMIT 1')) {
            const sorted = [...store.daily_prices].sort((a,b) => b.date.localeCompare(a.date));
            return sorted[0] || null;
          }
          if (s.includes('FROM daily_prices WHERE date <= ? ORDER BY date DESC LIMIT 1')) {
            const d = params[0];
            const sorted = store.daily_prices.filter(p => p.date <= d).sort((a,b) => b.date.localeCompare(a.date));
            return sorted[0] || null;
          }
          if (s.includes('FROM orders WHERE id = ?')) {
            const order = store.orders.find(o => o.id === Number(params[0]));
            if (!order) return null;
            const customer = store.users.find(u => u.id === order.user_id);
            return { ...order, customer_name: customer?.name || '', customer_phone: customer?.phone || '', customer_address: customer?.address || '' };
          }
          if (s.includes('SELECT COALESCE(SUM(CASE WHEN type = \'credit_added\'')) {
            const userId = Number(params[0]);
            return { balance: getUserCredit(userId) };
          }
          if (s.includes('SELECT COALESCE(SUM(trays), 0) as total_trays')) {
            const date = params[0];
            const active = store.orders.filter(o => o.order_date === date && o.order_status !== 'cancelled');
            return {
              total_trays: active.reduce((sum, o) => sum + o.trays, 0),
              total_orders: active.length
            };
          }
          if (s.includes('SELECT COALESCE(SUM(total_amount), 0) as cash_from_orders')) {
            const date = params[0];
            const cash = store.orders.filter(o => o.order_date === date && o.payment_mode === 'cash' && o.order_status !== 'cancelled');
            return { cash_from_orders: cash.reduce((sum, o) => sum + o.total_amount, 0) };
          }
          if (s.includes('SELECT COALESCE(SUM(amount), 0) as cash_from_settlements')) {
            const date = params[0];
            const settled = store.credit_ledger.filter(l => l.date === date && l.type === 'credit_settled');
            return { cash_from_settlements: settled.reduce((sum, l) => sum + l.amount, 0) };
          }
          if (s.includes('SELECT COALESCE(SUM(amount), 0) as total_credit_added')) {
            const date = params[0];
            const added = store.credit_ledger.filter(l => l.date === date && l.type === 'credit_added');
            return { total_credit_added: added.reduce((sum, l) => sum + l.amount, 0) };
          }
          if (s.includes('SELECT COALESCE(SUM(CASE WHEN type = \'credit_added\' THEN amount WHEN type = \'credit_settled\' THEN -amount ELSE 0 END), 0) as total_outstanding')) {
            const totalOut = store.credit_ledger.reduce((sum, l) => sum + (l.type === 'credit_added' ? l.amount : -l.amount), 0);
            return { total_outstanding: totalOut };
          }
          return null;
        },
        all: (...params) => {
          if (s.includes('FROM users WHERE role = \'user\'')) {
            return store.users.filter(u => u.role === 'user');
          }
          if (s.includes('FROM daily_prices ORDER BY date DESC')) {
            return [...store.daily_prices].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 60);
          }
          if (s.includes('FROM orders o JOIN users u') || s.includes('FROM orders WHERE user_id = ?')) {
            let list = [...store.orders];
            if (s.includes('user_id = ?')) list = list.filter(o => o.user_id === Number(params[0]));
            if (s.includes('order_date = ?')) list = list.filter(o => o.order_date === params[0]);
            return list.map(o => {
              const u = store.users.find(usr => usr.id === o.user_id);
              return { ...o, customer_name: u?.name || '', customer_phone: u?.phone || '', customer_address: u?.address || '' };
            }).sort((a,b) => b.id - a.id);
          }
          if (s.includes('FROM credit_ledger') && s.includes('user_id = ?')) {
            return store.credit_ledger.filter(l => l.user_id === Number(params[0])).sort((a,b) => b.id - a.id);
          }
          if (s.includes('FROM users u LEFT JOIN orders o') || s.includes('userBreakdown')) {
            const date = params[0] || today;
            return store.users.filter(u => u.role === 'user').map(u => {
              const userOrders = store.orders.filter(o => o.user_id === u.id && o.order_date === date && o.order_status !== 'cancelled');
              const trays_today = userOrders.reduce((sum, o) => sum + o.trays, 0);
              const cash_today = userOrders.filter(o => o.payment_mode === 'cash').reduce((sum, o) => sum + o.total_amount, 0);
              const credit_added_today = userOrders.filter(o => o.payment_mode === 'credit').reduce((sum, o) => sum + o.total_amount, 0);
              const running_credit_balance = getUserCredit(u.id);
              return {
                user_id: u.id,
                user_name: u.name,
                user_phone: u.phone,
                user_address: u.address,
                trays_today,
                cash_today,
                credit_added_today,
                running_credit_balance
              };
            });
          }
          return [];
        },
        run: (...params) => {
          if (s.includes('INSERT INTO users')) {
            const [name, phone, address, password_hash, role] = params;
            const id = store.users.length + 1;
            store.users.push({ id, name, phone, address, password_hash, role: role || 'user', created_at: today });
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.includes('INSERT INTO daily_prices')) {
            const [date, price] = params;
            const existing = store.daily_prices.find(p => p.date === date);
            if (existing) {
              existing.price_per_tray = Number(price);
              existing.updated_at = new Date().toISOString();
            } else {
              store.daily_prices.push({ id: store.daily_prices.length + 1, date, price_per_tray: Number(price), updated_at: new Date().toISOString() });
            }
            return { changes: 1, lastInsertRowid: store.daily_prices.length };
          }
          if (s.includes('INSERT INTO orders')) {
            const [user_id, order_date, delivery_date, trays, price_per_tray, total_amount, payment_mode, payment_status, order_status, notes, created_by] = params;
            const id = store.orders.length + 1;
            store.orders.push({
              id, user_id: Number(user_id), order_date, delivery_date, trays: Number(trays), price_per_tray: Number(price_per_tray),
              total_amount: Number(total_amount), payment_mode, payment_status, order_status: order_status || 'pending',
              notes: notes || '', created_by: created_by || 'user', created_at: today
            });
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.includes('INSERT INTO credit_ledger')) {
            const [user_id, order_id, amount, type, notes, date] = params;
            const id = store.credit_ledger.length + 1;
            store.credit_ledger.push({
              id, user_id: Number(user_id), order_id: order_id ? Number(order_id) : null,
              amount: Number(amount), type, notes: notes || '', date: date || today, created_at: today
            });
            return { lastInsertRowid: id, changes: 1 };
          }
          if (s.includes('UPDATE orders SET')) {
            return { changes: 1 };
          }
          return { changes: 0, lastInsertRowid: 0 };
        }
      };
    }
  };
}

module.exports = db;
