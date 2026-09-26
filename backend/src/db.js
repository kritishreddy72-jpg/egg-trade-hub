const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? '/tmp' : path.resolve(__dirname, '..');
const dbPath = path.join(dbDir, 'egg_trade.db');

let db = null;
let isNewDb = !fs.existsSync(dbPath);

// 1. Try better-sqlite3 first (standard local development)
try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  if (!isVercel) {
    db.pragma('journal_mode = WAL');
  } else {
    db.pragma('journal_mode = DELETE');
  }
} catch (err) {
  console.warn('better-sqlite3 native bindings unavailable, falling back to node:sqlite:', err.message);
}

// 2. Fallback to node:sqlite (native built-in to modern Node.js 22+, zero compilation dependencies)
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
  } catch (err) {
    console.error('Failed to initialize node:sqlite as well:', err);
    throw new Error('No compatible SQLite database engine found (better-sqlite3 or node:sqlite).');
  }
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

module.exports = db;
