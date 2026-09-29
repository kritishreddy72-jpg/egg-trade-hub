const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Retrieve database connection credentials from environment variables
const dbUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

let client;

if (dbUrl) {
  console.log(`Connecting to hosted persistent database: ${dbUrl.replace(/\/\/.*@/, '//***@')}`);
  client = createClient({
    url: dbUrl,
    authToken: authToken || undefined
  });
} else {
  // Local fallback: use persistent file-based SQLite database
  const localDir = isVercel ? '/tmp' : path.resolve(__dirname, '..');
  if (!fs.existsSync(localDir)) {
    try { fs.mkdirSync(localDir, { recursive: true }); } catch (e) {}
  }
  const localDbPath = path.join(localDir, 'egg_trade.db');
  console.log(`No remote database URL configured. Using local SQLite at: ${localDbPath}`);
  if (isVercel) {
    console.warn('WARNING: Running on Vercel without TURSO_DATABASE_URL. Serverless instances will use ephemeral /tmp storage. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to Vercel Environment Variables for persistence.');
  }
  client = createClient({
    url: `file:${localDbPath}`
  });
}

// Ensure schema and idempotent initial seed
let initPromise = null;

async function initDatabase() {
  try {
    // 1. Create tables and indexes if they do not exist
    await client.executeMultiple(`
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
        date TEXT NOT NULL UNIQUE,
        price_per_tray REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_date TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
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
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
      CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_mode, payment_status);
      CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(date);
    `);

    // 2. Check if users table is empty to perform idempotent seeding
    const userCountRes = await client.execute('SELECT COUNT(*) as count FROM users');
    const firstRow = userCountRes.rows[0];
    const count = firstRow ? Number(firstRow.count !== undefined ? firstRow.count : Object.values(firstRow)[0]) : 0;

    if (count === 0) {
      console.log('Database is empty on start — auto-seeding demo evaluation accounts...');
      const seedDatabase = require('./seed');
      await seedDatabase(db);
    } else {
      console.log(`Database already populated with ${count} users. Seeding skipped.`);
    }
  } catch (err) {
    console.error('Error during database initialization/seeding:', err);
    throw err;
  }
}

function ensureInitialized() {
  if (!initPromise) {
    initPromise = initDatabase().catch((err) => {
      initPromise = null; // Allow retry on subsequent request
      throw err;
    });
  }
  return initPromise;
}

// Trigger background initialization
ensureInitialized().catch((err) => {
  console.warn('Initial schema setup will retry on first incoming query:', err.message);
});

// Normalized Statement Wrapper for compatibility with both async and prepare-style queries
function prepare(sql) {
  return {
    async get(...params) {
      await ensureInitialized();
      const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const res = await client.execute({ sql, args });
      if (!res.rows || res.rows.length === 0) return null;
      return { ...res.rows[0] };
    },
    async all(...params) {
      await ensureInitialized();
      const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const res = await client.execute({ sql, args });
      return res.rows.map((row) => ({ ...row }));
    },
    async run(...params) {
      await ensureInitialized();
      const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const res = await client.execute({ sql, args });
      return {
        changes: Number(res.rowsAffected || 0),
        lastInsertRowid: Number(res.lastInsertRowid || 0)
      };
    }
  };
}

const db = {
  client,
  prepare,
  ensureInitialized,
  async get(sql, ...params) {
    return prepare(sql).get(...params);
  },
  async all(sql, ...params) {
    return prepare(sql).all(...params);
  },
  async run(sql, ...params) {
    return prepare(sql).run(...params);
  },
  async exec(sql) {
    await ensureInitialized();
    return client.executeMultiple(sql);
  },
  async batch(statements, mode = 'write') {
    await ensureInitialized();
    return client.batch(statements, mode);
  }
};

module.exports = db;
