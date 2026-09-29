const bcrypt = require('bcryptjs');

function getDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

async function seedDatabase(customDb) {
  const db = customDb || require('./db');
  console.log('Seeding Egg Trade database with demo accounts...');

  // Ensure tables exist before seeding
  if (typeof db.ensureInitialized === 'function') {
    // Already in initDatabase or called directly
  }

  // Clear existing data only when performing a manual re-seed
  try {
    await db.exec(`
      DELETE FROM credit_ledger;
      DELETE FROM orders;
      DELETE FROM daily_prices;
      DELETE FROM users;
    `);
  } catch (e) {
    // If tables are empty or newly created, ignore
  }

  const ownerSalt = bcrypt.genSaltSync(10);
  const ownerHash = bcrypt.hashSync('owner123', ownerSalt);

  const userSalt = bcrypt.genSaltSync(10);
  const userHash = bcrypt.hashSync('user123', userSalt);

  // 1. Seed Owner
  const insertUser = db.prepare(`
    INSERT INTO users (name, phone, email, address, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const ownerInfo = await insertUser.run(
    'Rajesh Sharma (Owner)',
    '9999999999',
    'owner@eggtrade.com',
    'Egg Trade Wholesale Hub, Shop 10-12, APMC Market',
    ownerHash,
    'owner'
  );
  const ownerId = ownerInfo.lastInsertRowid;

  // 2. Seed Customers
  const customer1 = await insertUser.run(
    'Sri Krishna Bakery',
    '9876543211',
    'krishna.bakery@example.com',
    '12 MG Road, Market Area',
    userHash,
    'user'
  );

  const customer2 = await insertUser.run(
    'Anand Supermarket',
    '9876543212',
    'anand.store@example.com',
    'Shop 4, Commercial Complex, Main Bazaar',
    userHash,
    'user'
  );

  const customer3 = await insertUser.run(
    'Hotel Annapurna',
    '9876543213',
    'annapurna.hotel@example.com',
    'Opp. City Bus Stand, Highway Junction',
    userHash,
    'user'
  );

  const customer4 = await insertUser.run(
    'Ramesh Dhabha',
    '9876543214',
    'ramesh.dhabha@example.com',
    'Highway Bypass, Sector 5',
    userHash,
    'user'
  );

  const c1Id = customer1.lastInsertRowid;
  const c2Id = customer2.lastInsertRowid;
  const c3Id = customer3.lastInsertRowid;
  const c4Id = customer4.lastInsertRowid;

  // 3. Seed Daily Prices (today and past 4 days)
  const insertPrice = db.prepare(`
    INSERT INTO daily_prices (date, price_per_tray)
    VALUES (?, ?)
  `);

  const dayMinus4 = getDateOffset(-4);
  const dayMinus3 = getDateOffset(-3);
  const dayMinus2 = getDateOffset(-2);
  const dayMinus1 = getDateOffset(-1);
  const today = getDateOffset(0);

  await insertPrice.run(dayMinus4, 195.00);
  await insertPrice.run(dayMinus3, 198.00);
  await insertPrice.run(dayMinus2, 202.00);
  await insertPrice.run(dayMinus1, 205.00);
  await insertPrice.run(today, 210.00);

  // 4. Seed Past Orders and Credit Ledger
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      user_id, order_date, delivery_date, trays, price_per_tray,
      total_amount, payment_mode, payment_status, order_status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLedger = db.prepare(`
    INSERT INTO credit_ledger (user_id, order_id, amount, type, notes, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // --- Customer 1 (Sri Krishna Bakery) ---
  const o1 = await insertOrder.run(c1Id, dayMinus3, dayMinus3, 50, 198.00, 9900.00, 'credit', 'pending', 'delivered', 'Regular morning bulk delivery', 'user');
  await insertLedger.run(c1Id, o1.lastInsertRowid, 9900.00, 'credit_added', `Credit for Order #${o1.lastInsertRowid} (50 trays)`, dayMinus3);

  await insertLedger.run(c1Id, null, 5000.00, 'credit_settled', 'Bank Transfer / Cash payment received', dayMinus1);

  const o2 = await insertOrder.run(c1Id, dayMinus1, dayMinus1, 40, 205.00, 8200.00, 'credit', 'pending', 'delivered', 'Special cake batch egg requirement', 'user');
  await insertLedger.run(c1Id, o2.lastInsertRowid, 8200.00, 'credit_added', `Credit for Order #${o2.lastInsertRowid} (40 trays)`, dayMinus1);

  const o3 = await insertOrder.run(c1Id, today, today, 45, 210.00, 9450.00, 'credit', 'pending', 'pending', 'Morning dispatch please deliver before 10 AM', 'user');
  await insertLedger.run(c1Id, o3.lastInsertRowid, 9450.00, 'credit_added', `Credit for Order #${o3.lastInsertRowid} (45 trays)`, today);

  // --- Customer 2 (Anand Supermarket) ---
  await insertOrder.run(c2Id, dayMinus4, dayMinus4, 80, 195.00, 15600.00, 'cash', 'paid', 'delivered', 'Weekend stock replenishment', 'user');

  const o4 = await insertOrder.run(c2Id, dayMinus2, dayMinus2, 60, 202.00, 12120.00, 'credit', 'pending', 'delivered', 'Mid-week stock', 'user');
  await insertLedger.run(c2Id, o4.lastInsertRowid, 12120.00, 'credit_added', `Credit for Order #${o4.lastInsertRowid} (60 trays)`, dayMinus2);

  const o5 = await insertOrder.run(c2Id, today, today, 70, 210.00, 14700.00, 'credit', 'pending', 'confirmed', 'Daily grocery retail trays', 'owner');
  await insertLedger.run(c2Id, o5.lastInsertRowid, 14700.00, 'credit_added', `Credit for Order #${o5.lastInsertRowid} (70 trays)`, today);

  // --- Customer 3 (Hotel Annapurna) ---
  await insertOrder.run(c3Id, dayMinus3, dayMinus3, 30, 198.00, 5940.00, 'cash', 'paid', 'delivered', 'Breakfast buffet usage', 'user');

  const o6 = await insertOrder.run(c3Id, dayMinus1, dayMinus1, 35, 205.00, 7175.00, 'credit', 'pending', 'delivered', 'Kitchen order', 'user');
  await insertLedger.run(c3Id, o6.lastInsertRowid, 7175.00, 'credit_added', `Credit for Order #${o6.lastInsertRowid} (35 trays)`, dayMinus1);

  await insertOrder.run(c3Id, today, today, 40, 210.00, 8400.00, 'cash', 'pending', 'out_for_delivery', 'Hand over to head chef', 'user');

  // --- Customer 4 (Ramesh Dhabha) ---
  await insertOrder.run(c4Id, dayMinus2, dayMinus2, 25, 202.00, 5050.00, 'cash', 'paid', 'delivered', 'Curry eggs supply', 'user');

  await insertOrder.run(c4Id, today, today, 30, 210.00, 6300.00, 'cash', 'paid', 'delivered', 'Early morning counter delivery - Cash Paid', 'owner');

  console.log('Seeding completed successfully!');
  console.log('Owner Account: 9999999999 / owner123');
  console.log('Sample Customers: 9876543211, 9876543212, 9876543213, 9876543214 / user123');
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seed finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed execution error:', err);
      process.exit(1);
    });
}

module.exports = seedDatabase;
