const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// On Vercel / AWS Lambda, the root filesystem is read-only.
// We store the SQLite DB in /tmp to ensure full read/write capability.
const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? '/tmp' : path.resolve(__dirname, '..');
const dbPath = path.join(dbDir, 'egg_trade.db');

const needsSeed = isVercel && !fs.existsSync(dbPath);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

if (!isVercel) {
  db.pragma('journal_mode = WAL');
} else {
  db.pragma('journal_mode = DELETE');
}

// Initialize schema
function initSchema() {
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
}

initSchema();

if (needsSeed) {
  try {
    const seedDatabase = require('./seed');
    if (typeof seedDatabase === 'function') {
      seedDatabase();
    }
  } catch (err) {
    console.error('Auto-seed error on Vercel initialization:', err);
  }
}

module.exports = db;
